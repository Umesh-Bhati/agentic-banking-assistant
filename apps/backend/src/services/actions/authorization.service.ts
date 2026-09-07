import { ActionRepository } from '../../repositories/action.repository.js';
import { ActionState, PendingAction, AuthCredentials } from '@boit/shared-types';
import { SupabaseClient } from '@supabase/supabase-js';

export type { AuthCredentials };

export class AuthorizationService {
  constructor(
    private actionRepo: ActionRepository,
    private supabase: SupabaseClient
  ) {}

  async authorizeAction(
    actionId: string,
    userId: string,
    credentials: AuthCredentials
  ): Promise<PendingAction> {
    const action = await this.actionRepo.getById(actionId);
    if (!action) {
      throw new Error(`Action '${actionId}' not found in database.`);
    }

    // STRICT ownership — NO hardcoded ID bypass
    const isOwner =
      action.userId === userId ||
      action.metadata?.authUserId === userId ||
      action.metadata?.customerId === userId;

    if (!isOwner) {
      throw new Error(`Unauthorized: User '${userId}' does not own action '${actionId}'.`);
    }

    if (action.status !== ActionState.PENDING_AUTHORIZATION) {
      throw new Error(`Cannot authorize action in state ${action.status}`);
    }

    // Route to correct auth method
    if (credentials.biometricToken) {
      return this.authorizeBiometric(actionId);
    }
    if (credentials.email && credentials.password) {
      return this.authorizeCredentials(actionId, credentials.email, credentials.password);
    }
    if (credentials.pin) {
      return this.authorizePin(actionId, userId, credentials.pin);
    }

    throw new Error('No valid credentials provided for authorization.');
  }

  private async authorizePin(actionId: string, userId: string, pin: string): Promise<PendingAction> {
    if (!/^\d{4}$/.test(pin)) {
      throw new Error('Invalid PIN format. Must be a 4-digit numeric passcode.');
    }

    if (this.supabase) {
      const { data: isValid, error } = await this.supabase.rpc('verify_customer_pin', {
        p_customer_id: userId,
        p_pin: pin,
      });

      if (error) {
        console.warn('RPC verify_customer_pin failed:', error.message);
      } else if (!isValid) {
        throw new Error('Incorrect PIN. Authorization failed.');
      }
    }

    return this.actionRepo.updateStatus(actionId, ActionState.AUTHORIZED, {
      authMethod: 'PIN',
      authorizedAt: new Date().toISOString(),
    });
  }

  private async authorizeBiometric(actionId: string): Promise<PendingAction> {
    // Biometric validation happens on-device via expo-local-authentication.
    // The mobile app only sends the token after successful device-level auth.
    return this.actionRepo.updateStatus(actionId, ActionState.AUTHORIZED, {
      authMethod: 'BIOMETRIC',
      authorizedAt: new Date().toISOString(),
    });
  }

  private async authorizeCredentials(
    actionId: string,
    email: string,
    password: string
  ): Promise<PendingAction> {
    // Re-authenticate against Supabase Auth — ephemeral, not stored
    const { error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error('Invalid credentials. Authorization failed.');
    }

    return this.actionRepo.updateStatus(actionId, ActionState.AUTHORIZED, {
      authMethod: 'CREDENTIALS',
      authorizedAt: new Date().toISOString(),
    });
  }
}
