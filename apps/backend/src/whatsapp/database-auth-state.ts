import { AuthenticationCreds, AuthenticationState, SignalDataTypeMap, BufferJSON, initAuthCreds } from '@whiskeysockets/baileys';
import { WhatsappService } from './whatsapp.service';

/**
 * Custom Baileys auth state that saves data to PostgreSQL via Prisma
 */
export const useDatabaseAuthState = async (sessionId: string, whatsappService: WhatsappService): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> => {

    const authRecord = await whatsappService.getAuthState(sessionId);
    let creds: AuthenticationCreds = authRecord?.creds
        ? JSON.parse(JSON.stringify(authRecord.creds), BufferJSON.reviver)
        : initAuthCreds();

    const keys: any = authRecord?.keys
        ? JSON.parse(JSON.stringify(authRecord.keys), BufferJSON.reviver)
        : {};

    const saveState = async () => {
        const credsJSON = JSON.parse(JSON.stringify(creds, BufferJSON.replacer));
        const keysJSON = JSON.parse(JSON.stringify(keys, BufferJSON.replacer));

        await whatsappService.saveAuthState(sessionId, credsJSON, keysJSON);
    };

    return {
        state: {
            creds,
            keys: {
                get: (type, ids) => {
                    const data: { [id: string]: any } = {};
                    for (const id of ids) {
                        let value = keys[type]?.[id];
                        if (value) {
                            if (type === 'app-state-sync-key') {
                                value = JSON.parse(JSON.stringify(value), BufferJSON.reviver);
                            }
                            data[id] = value;
                        }
                    }
                    return data;
                },
                set: async (data: any) => {
                    let hasChanged = false;
                    const signalData = data as any;
                    for (const type in signalData) {
                        if (!keys[type]) keys[type] = {};
                        for (const id in signalData[type]) {
                            const value = signalData[type][id];
                            keys[type][id] = value;
                            hasChanged = true;
                        }
                    }

                    if (hasChanged) {
                        await saveState();
                    }
                }
            }
        },
        saveCreds: saveState
    };
};
