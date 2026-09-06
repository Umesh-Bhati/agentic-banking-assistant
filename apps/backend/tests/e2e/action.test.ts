import { describe, it, expect, vi, beforeEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { ActionState } from '@boit/shared-types';

const mockActionRow = {
  id: 'act-123',
  user_id: '7b0cddc1-fa5c-4fd1-91e9-665f45b9d273',
  customer_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  action_type: 'BLOCK_CARD',
  status: ActionState.PENDING_SELECTION,
  metadata: { cardId: 'card-1' },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

let currentActionState = ActionState.PENDING_SELECTION;

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: '7b0cddc1-fa5c-4fd1-91e9-665f45b9d273', email: 'john.doe@gmail.com' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'customer_profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', user_id: '7b0cddc1-fa5c-4fd1-91e9-665f45b9d273' },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn((updateData: any) => {
          if (updateData.status) currentActionState = updateData.status;
          return {
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockImplementation(async () => ({
              data: { ...mockActionRow, status: currentActionState },
              error: null,
            })),
          };
        }),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(async () => ({
          data: { ...mockActionRow, status: currentActionState },
          error: null,
        })),
      };
    }),
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  })),
}));

import { createActionRoutes } from '../../src/routes/action.routes.js';
import authPlugin from '../../src/plugins/auth.plugin.js';

describe('Action Routes E2E', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    currentActionState = ActionState.PENDING_SELECTION;
    app = fastify();
    await app.register(authPlugin, {
      supabaseUrl: 'http://localhost:54321',
      supabaseServiceKey: 'test-key',
    });
    await createActionRoutes(app, {
      supabaseUrl: 'http://localhost:54321',
      supabaseServiceKey: 'test-key',
    });
    await app.ready();
  });

  it('should confirm an action successfully', async () => {
    currentActionState = ActionState.PENDING_SELECTION;
    const res = await app.inject({
      method: 'POST',
      url: '/actions/act-123/confirm',
      headers: { authorization: 'Bearer test-token' },
      payload: { userId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', cardId: 'card-1' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
  });

  it('should authorize action with 4-digit PIN', async () => {
    currentActionState = ActionState.PENDING_AUTHORIZATION;
    const res = await app.inject({
      method: 'POST',
      url: '/actions/act-123/authorize',
      headers: { authorization: 'Bearer test-token' },
      payload: { userId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', pin: '1234' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
  });

  it('should authorize action with biometric assertion token', async () => {
    currentActionState = ActionState.PENDING_AUTHORIZATION;
    const res = await app.inject({
      method: 'POST',
      url: '/actions/act-123/authorize',
      headers: { authorization: 'Bearer test-token' },
      payload: { userId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', biometricToken: 'bio_verified_998877' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
  });
});
