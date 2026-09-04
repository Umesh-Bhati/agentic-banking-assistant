import path from 'path';
import { fileURLToPath } from 'url';
import Firecrawl from 'firecrawl';
import { MDocument } from '@mastra/rag';
import { embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fallback search for .env in monorepo root or apps/backend/.env
config();
config({ path: path.resolve(__dirname, '../.env') });
config({ path: path.resolve(__dirname, '../../../.env') });
config({ path: path.resolve(__dirname, '../../../apps/backend/.env') });
config({ path: path.resolve(process.cwd(), 'apps/backend/.env') });

interface IngestionConfig {
  firecrawlApiKey: string;
  apiKey: string;
  isOpenRouter: boolean;
  supabaseUrl: string;
  supabaseServiceKey: string;
  urls: string[];
}

function cleanEnvVal(val?: string): string {
  if (!val) return '';
  return val.split('#')[0].trim();
}

function getConfig(): IngestionConfig {
  const firecrawlApiKey = cleanEnvVal(process.env.FIRECRAWL_API_KEY);
  const openrouterApiKey = cleanEnvVal(process.env.OPENROUTER_API_KEY);
  const openaiApiKey = cleanEnvVal(process.env.OPENAI_API_KEY);
  const supabaseUrl = cleanEnvVal(process.env.SUPABASE_URL);
  const supabaseServiceKey = cleanEnvVal(process.env.SUPABASE_SERVICE_KEY);

  const apiKey = openrouterApiKey || (openaiApiKey !== 'your_openai_api_key' ? openaiApiKey : '');
  const isOpenRouter = !!openrouterApiKey || !openaiApiKey || openaiApiKey === 'your_openai_api_key';

  if (!firecrawlApiKey) throw new Error('Missing FIRECRAWL_API_KEY in environment');
  if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY or valid OPENAI_API_KEY in environment');
  if (!supabaseUrl) throw new Error('Missing SUPABASE_URL in environment');
  if (!supabaseServiceKey) throw new Error('Missing SUPABASE_SERVICE_KEY in environment');

  return {
    firecrawlApiKey,
    apiKey,
    isOpenRouter,
    supabaseUrl,
    supabaseServiceKey,
    urls: [
      'https://almasraf.ae/en/personal/accounts',
      'https://almasraf.ae/en/personal/cards',
      'https://almasraf.ae/en/personal/loans',
    ],
  };
}

interface ChunkRecord {
  content: string;
  metadata: Record<string, unknown>;
  embedding: number[];
}

async function scrapeUrl(firecrawl: Firecrawl, url: string): Promise<string | null> {
  try {
    console.log(`Scraping: ${url}`);
    const result = await firecrawl.scrapeUrl(url, {
      formats: ['markdown'],
      onlyMainContent: true,
      waitFor: 3000,
    });

    if (result.success && result.markdown) {
      console.log(`  ✓ Scraped ${result.markdown.length} characters`);
      return result.markdown;
    } else {
      console.error(`  ✗ Failed to scrape ${url}:`, (result as any).error);
      return null;
    }
  } catch (error) {
    console.error(`  ✗ Error scraping ${url}:`, error);
    return null;
  }
}

async function chunkContent(content: string, url: string) {
  const doc = MDocument.fromText(content);
  const chunks = await doc.chunk({
    strategy: 'recursive',
    maxSize: 512,
    overlap: 50,
    separators: ['\n'],
  });

  return chunks.map((chunk, index) => ({
    content: chunk.text,
    metadata: {
      source_url: url,
      chunk_index: index,
      ...chunk.metadata,
    },
  }));
}

async function generateEmbeddings(texts: string[], apiKey: string, isOpenRouter: boolean): Promise<number[][]> {
  const providerConfig = isOpenRouter
    ? { baseURL: 'https://openrouter.ai/api/v1', apiKey }
    : { apiKey };

  const provider = createOpenAI(providerConfig);
  const modelName = isOpenRouter ? 'openai/text-embedding-3-small' : 'text-embedding-3-small';

  const { embeddings } = await embedMany({
    model: provider.embedding(modelName),
    values: texts,
  });
  return embeddings;
}

async function insertIntoSupabase(
  supabase: SupabaseClient,
  chunks: Array<{ content: string; metadata: Record<string, unknown> }>,
  embeddings: number[][]
) {
  const records: ChunkRecord[] = chunks.map((chunk, index) => ({
    content: chunk.content,
    metadata: chunk.metadata,
    embedding: embeddings[index],
  }));

  const { error } = await supabase.from('bank_documents').insert(records);

  if (error) {
    throw new Error(`Failed to insert into Supabase: ${error.message}`);
  }

  console.log(`  ✓ Inserted ${records.length} chunks into Supabase`);
}

async function main() {
  console.log('Starting Firecrawl ingestion pipeline...\n');

  const config = getConfig();
  const firecrawl = new Firecrawl({ apiKey: config.firecrawlApiKey });
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

  let totalChunks = 0;

  for (const url of config.urls) {
    const markdown = await scrapeUrl(firecrawl, url);
    if (!markdown) continue;

    const chunks = await chunkContent(markdown, url);
    if (chunks.length === 0) continue;

    const texts = chunks.map(c => c.content);
    const embeddings = await generateEmbeddings(texts, config.apiKey, config.isOpenRouter);
    await insertIntoSupabase(supabase, chunks, embeddings);
    totalChunks += chunks.length;
  }

  console.log(`\n✓ Ingestion complete! Total chunks: ${totalChunks}`);
}

main().catch(console.error);