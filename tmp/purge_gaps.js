import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.PROTOCOL_SUPABASE_URL, process.env.PROTOCOL_SUPABASE_KEY);

const matchesToDelete = [
    "90a65a19-b812-4998-a190-ea7a9f8d290c",
    "ce73e446-9a89-47a4-b894-c55e78b08762",
    "a1201cce-5fe4-4eae-9635-013a4cf0c38c",
    "45d9fee0-f450-4c63-893f-8f837eb5a450",
    "008c7426-c7cf-4fac-a8bc-954dffe5e5f7",
    "0381954d-7086-4851-b510-309fe84a92b6",
    "50d945c5-a579-434b-a546-99210b0e021e",
    "8fab8c04-a9ac-4749-8ae6-442456774333",
    "cec10f53-ecfd-4901-bc69-997c6536a6e1",
    "2329d69a-3472-4a4e-97e4-ff1272aadefa",
    "17ed7ab5-60f8-451e-9420-8bb0a51110f7",
    "25259f33-8437-4f1f-90f4-43727ac8eb28",
    "0432591c-a709-44ec-8b90-2119c53b9012",
    "0798b8b1-97da-4d8b-9cc8-d604090f1276",
    "8dbe2e21-a811-4024-a4ee-145bedc064ea",
    "bc494750-8522-43da-a65e-f65aa07a8c7a",
    "0f8e8af5-83a2-4080-860b-e39355448832",
    "008c8374-3b19-4e3a-bfb1-b773b28e5c60",
    "8cea3aed-e1e3-4834-a960-69e4be58dfd6",
    "2c7944be-f3c4-4429-a0fa-8d3604acd7a7",
    "16411a96-f76c-4236-bec4-8f195456de73",
    "d276812f-c88f-4840-89c2-8d78c2cfe3ac",
    "8592c68d-54f4-4993-b66d-93254f3d25c0",
    "974dbcef-759b-4cd5-aab8-592d1e235a37",
    "70b46af7-3283-438e-b5f9-f25b330dbf97",
    "70f0470c-2502-4b73-9be9-83e79195745f",
    "16de3d7c-2b70-46a2-a7c8-d5f9d4456824",
    "eebdcb2e-96f3-4f38-bb6f-f59e4f938254",
    "664f2cdf-66fd-4b40-b4be-414558421045"
];

async function removeTacticalGaps() {
    console.log(`🧹 Iniciando purga de ${matchesToDelete.length} registros para o jogador GUXXTAVO#EASY...`);
    
    // Usar match_id no operation_squads é operation_id
    const { count, error } = await supabase
        .from('operation_squads')
        .delete({ count: 'exact' })
        .ilike('riot_id', 'GUXXTAVO#EASY')
        .in('operation_id', matchesToDelete);

    if (error) {
        console.error('❌ Erro na operação:', error.message);
    } else {
        console.log(`✅ Purga concluída com sucesso. ${count} registros removidos de operation_squads.`);
    }
}

removeTacticalGaps();
