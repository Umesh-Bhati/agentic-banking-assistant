import Firecrawl from 'firecrawl';
import { MDocument } from '@mastra/rag';
import { embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

interface IngestionConfig {
  firecrawlApiKey: string;
  openaiApiKey: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  urls: string[];
}

function getConfig(): IngestionConfig {
  const required = [
    'FIRECRAWL_API_KEY',
    'OPENAI_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return {
    firecrawlApiKey: process.env.FIRECRAWL_API_KEY!,
    openaiApiKey: process.env.OPENAI_API_KEY!,
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY!,
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

async function generateEmbeddings(texts: string[], openaiApiKey: string): Promise<number[][]> {
  const openai = createOpenAI({ apiKey: openaiApiKey });
  const { embeddings } = await embedMany({
    model: openai.embedding('text-embedding-3-small'),
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
    const embeddings = await generateEmbeddings(texts, config.openaiApiKey);
    await insertIntoSupabase(supabase, chunks, embeddings);
    totalChunks += chunks.length;
  }

  console.log(`\n✓ Ingestion complete! Total chunks: ${totalChunks}`);
}

main().catch(console.error);