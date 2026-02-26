
import { Prisma } from '@prisma/client';

type WhereInput = Prisma.ContactFlowStateWhereInput;
type Keys = keyof WhereInput;

const keys: Keys[] = [
    'id',
    'sessionId',
    'contactId',
    'workflowId',
    'currentNodeId',
    'executionId',
    'expiresAt',
    'createdAt',
    'updatedAt'
] as any;

console.log('Available keys in ContactFlowStateWhereInput:');
// This is a dummy script just to check if it compiles or if I can find the keys
