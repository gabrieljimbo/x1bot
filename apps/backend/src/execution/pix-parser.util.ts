/**
 * Utility to parse PIX receipt data from OCR text with bank-specific logic
 */
export class PixParser {
    /**
     * Parse extracted text into structured PIX data
     */
    static parse(text: string) {
        const normalized = text.replace(/\r/g, '').replace(/\n+/g, ' \n ').replace(/\s{2,}/g, ' ');
        const bank = this.identifyBank(normalized);

        const data: any = {
            amount: 0,
            date: null,
            receiverName: null,
            receiverTaxId: null,
            transactionId: null,
            bank: bank || 'Unknown',
            pixKey: null,
            rawText: text
        };

        // Apply specific rules based on the bank
        switch (data.bank) {
            case 'Nubank':
                this.parseNubank(normalized, data);
                break;
            case 'Itaú':
                this.parseItau(normalized, data);
                break;
            case 'Bradesco':
                this.parseBradesco(normalized, data);
                break;
            case 'Banco do Brasil':
                this.parseBB(normalized, data);
                break;
            case 'Santander':
                this.parseSantander(normalized, data);
                break;
            case 'Inter':
                this.parseInter(normalized, data);
                break;
            case 'PicPay':
                this.parsePicPay(normalized, data);
                break;
            case 'C6 Bank':
                this.parseC6(normalized, data);
                break;
            case 'Caixa':
                this.parseCaixa(normalized, data);
                break;
            case 'Sicoob':
                this.parseSicoob(normalized, data);
                break;
            default:
                this.parseGeneric(normalized, data);
        }

        // Final cleanup
        if (data.date) {
            // Standardize date to DD/MM/YYYY
            const dateMatch = data.date.match(/(\d{2})[\/\s](\d{2})[\/\s](\d{4})/);
            if (dateMatch) {
                data.date = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
            }
        }

        return data;
    }

    private static identifyBank(text: string): string | null {
        const t = text.toUpperCase();
        if (t.includes('NUBANK') || t.includes('NU PAGAMENTOS')) return 'Nubank';
        if (t.includes('ITAÚ') || t.includes('ITAU')) return 'Itaú';
        if (t.includes('BRADESCO')) return 'Bradesco';
        if (t.includes('BANCO DO BRASIL')) return 'Banco do Brasil';
        if (t.includes('SANTANDER')) return 'Santander';
        if (t.includes('BANCO INTER') || t.includes(' INTER ')) return 'Inter';
        if (t.includes('PICPAY')) return 'PicPay';
        if (t.includes('C6 BANK')) return 'C6 Bank';
        if (t.includes('CAIXA ECON')) return 'Caixa';
        if (t.includes('SICOOB')) return 'Sicoob';
        return null;
    }

    private static parseNubank(text: string, data: any) {
        data.amount = this.extractRegex(text, /(?:Valor|R\$)\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i, true);
        data.date = this.extractRegex(text, /(\d{2}\s[A-Z]{3}\s\d{4}|\d{2}\/\d{2}\/\d{4})/i);
        data.receiverName = this.extractRegex(text, /(?:Para|Recebedor)\s*([A-Z\s]{3,50})(?:\s*[\n\r]|CPF|CNPJ|$)/i);
        data.transactionId = this.extractRegex(text, /\b(E\d{8}[A-Za-z0-9]{15,})\b/);
        data.receiverTaxId = this.extractRegex(text, /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/);
    }

    private static parseItau(text: string, data: any) {
        data.amount = this.extractRegex(text, /(?:valor)\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i, true);
        data.date = this.extractRegex(text, /(\d{2}\/\d{2}\/\d{4})/);
        data.receiverName = this.extractRegex(text, /(?:pago para|para)\s*([A-Z\s]{3,50})/i);
        data.transactionId = this.extractRegex(text, /(?:Id da transação|Identificador)\s*([A-Z0-9]{15,})/i);
    }

    private static parseBradesco(text: string, data: any) {
        data.amount = this.extractRegex(text, /(?:Valor)\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i, true);
        data.date = this.extractRegex(text, /(\d{2}\/\d{2}\/\d{4})/);
        data.receiverName = this.extractRegex(text, /(?:Nome do favorecido|Para)\s*([A-Z\s]{3,50})/i);
    }

    private static parseBB(text: string, data: any) {
        data.amount = this.extractRegex(text, /(?:Valor total)\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i, true);
        data.date = this.extractRegex(text, /(\d{2}\/\d{2}\/\d{4})/);
        data.receiverName = this.extractRegex(text, /(?:Recebedor|Para)\s*([A-Z\s]{3,50})/i);
    }

    private static parseSantander(text: string, data: any) {
        data.amount = this.extractRegex(text, /(?:valor)\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i, true);
        data.date = this.extractRegex(text, /(\d{2}\/\d{2}\/\d{4})/);
        data.receiverName = this.extractRegex(text, /(?:nome do recebedor|para)\s*([A-Z\s]{3,50})/i);
    }

    private static parseInter(text: string, data: any) {
        data.amount = this.extractRegex(text, /(?:valor pago)\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i, true);
        data.date = this.extractRegex(text, /(\d{2}\/\d{2}\/\d{4})/);
        data.receiverName = this.extractRegex(text, /(?:recebedor|para)\s*([A-Z\s]{3,50})/i);
    }

    private static parsePicPay(text: string, data: any) {
        data.amount = this.extractRegex(text, /(?:valor)\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i, true);
        data.date = this.extractRegex(text, /(\d{2}\/\d{2}\/\d{4})/);
        data.receiverName = this.extractRegex(text, /(?:quem recebeu|para)\s*([A-Z\s]{3,50})/i);
    }

    private static parseC6(text: string, data: any) {
        data.amount = this.extractRegex(text, /(?:valor)\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i, true);
        data.date = this.extractRegex(text, /(\d{2}\/\d{2}\/\d{4})/);
        data.receiverName = this.extractRegex(text, /(?:recebedor|para)\s*([A-Z\s]{3,50})/i);
    }

    private static parseCaixa(text: string, data: any) {
        data.amount = this.extractRegex(text, /(?:valor)\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i, true);
        data.date = this.extractRegex(text, /(\d{2}\/\d{2}\/\d{4})/);
        data.receiverName = this.extractRegex(text, /(?:pago para|para)\s*([A-Z\s]{3,50})/i);
    }

    private static parseSicoob(text: string, data: any) {
        data.amount = this.extractRegex(text, /(?:valor)\s*R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i, true);
        data.date = this.extractRegex(text, /(\d{2}\/\d{2}\/\d{4})/);
        data.receiverName = this.extractRegex(text, /(?:recebedor|para)\s*([A-Z\s]{3,50})/i);
    }

    private static parseGeneric(text: string, data: any) {
        data.amount = this.extractRegex(text, /(?:R\$|Valor|TOTAL)\s*:?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i, true);
        data.date = this.extractRegex(text, /(\d{2}\/\d{2}\/\d{4})/);
        data.receiverName = this.extractRegex(text, /(?:Recebedor|Para|Destinatário)\s*:?\s*([A-Z\s]{3,50})/i);
        data.transactionId = this.extractRegex(text, /(?:ID|Transação|Autenticação)\s*:?\s*([A-Z0-9]{15,})/i);
        if (!data.transactionId) data.transactionId = this.extractRegex(text, /\b(E\d{8}[A-Za-z0-9]{15,})\b/);
    }

    private static extractRegex(text: string, regex: RegExp, isAmount = false): any {
        const match = text.match(regex);
        if (match) {
            if (isAmount) {
                const val = match[1].replace(/\./g, '').replace(',', '.');
                return parseFloat(val);
            }
            return match[1].trim();
        }
        return isAmount ? 0 : null;
    }
}
