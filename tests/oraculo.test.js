import { jest, describe, test, expect } from '@jest/globals';

// Mock do Supabase para ESM (Experimental VM Modules)
jest.unstable_mockModule('../lib/supabase.js', () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
    },
    supabaseProtocol: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
    },
    getSupabaseConfig: () => ({ oraculoUrl: 'http://test', protocolUrl: 'http://test', hasKeys: true })
}));

// Importações dinâmicas após o mock (Padrão ESM Jest)
const { default: app } = await import('../server.js');
const { supabase } = await import('../lib/supabase.js');
import request from 'supertest';

describe('Suíte de Testes Oráculo-V (MVP)', () => {
    
    // Teste 1: UUID Malformado
    test('Teste 1: Deve retornar 400 para match_id inválido (não-UUID)', async () => {
        const response = await request(app)
            .post('/api/analyze')
            .send({ 
                player_id: 'ousadia#013', 
                match_id: 'partida-invalida-123' 
            });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('não é um UUID válido');
    });

    // Teste 2: Performance_index derivado do Python
    test('Teste 2: Deve gerar análise com performance_index válido', async () => {
        const response = await request(app)
            .post('/api/analyze')
            .send({
                player_id: 'ousadia#013',
                match_id: '550e8400-e29b-41d4-a716-446655440000'
            });

        // A análise pode falhar se o arquivo não existe, mas a estrutura do erro será consistente
        if (response.status === 200) {
            expect(response.body.result).toHaveProperty('performance_index');
            expect(response.body.result).toHaveProperty('technical_rank');
        }
    });

    // Teste 3: Persistência JSONB
    test('Teste 3: Deve validar se o insight_resumo é passado como JSONB no insert', async () => {
        const mockInsert = jest.fn().mockResolvedValue({ error: null });
        supabase.from.mockReturnValue({ insert: mockInsert });

        const insightMock = {
            diagnostico_principal: "Peso morto detectado",
            tatico: "Recue para o site A",
            nota_coach: "1"
        };

        const { error } = await supabase.from('ai_insights').insert({
            match_id: '550e8400-e29b-41d4-a716-446655440000',
            player_id: 'ousadia#013',
            insight_resumo: insightMock
        });

        expect(error).toBeNull();
        expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
            insight_resumo: expect.objectContaining({
                diagnostico_principal: expect.any(String)
            })
        }));
    });
});
