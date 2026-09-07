export enum ActionState {
  CREATED = 'CREATED',
  PENDING_SELECTION = 'PENDING_SELECTION',
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION',
  PENDING_AUTHORIZATION = 'PENDING_AUTHORIZATION',
  AUTHORIZED = 'AUTHORIZED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

export interface PendingAction {
  id: string;
  userId: string;
  actionType: string;
  status: ActionState;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface AuthCredentials {
  pin?: string;
  biometricToken?: string;
  email?: string;
  password?: string;
}
