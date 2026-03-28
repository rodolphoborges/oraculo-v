import { supabase, supabaseProtocol } from '../lib/supabase.js';

const matchId = 'b321fc60-a15f-441d-8ba3-7ec0dc11fe0b';

const insights = [
    {
        player_id: 'mwzeraDaShopee#s2s2',
        insight: {
            diagnostico_principal: "Performance de elite (Imortal/Radiante). Domínio total do mapa com 26 kills e ADR excepcional de 211.",
            foco_treino: ["Refinar o timing de dash após o fade-away", "Maximizar o uso de facas em rodadas eco para quebrar a economia inimiga"],
            tatico: "Mantenha a agressividade no Long do site A em Pearl. Seu tempo de reação está punindo qualquer wide peak inimigo.",
            nota_coach: "9.5"
        }
    },
    {
        player_id: 'Vduart#MEE',
        insight: {
            diagnostico_principal: "Controlador sólido com excelente suporte de smokes e participação ativa em trade kills.",
            foco_treino: ["Estudar lineups de molly para pós-plant no site B", "Melhorar a sobrevivência em rodadas econômicas"],
            tatico: "Garanta a cobertura do Meio com smokes defensivas antes da rotação completa do time.",
            nota_coach: "8.2"
        }
    },
    {
        player_id: 'ALEGRIA#021',
        insight: {
            diagnostico_principal: "Iniciador focado em assistência. Boa leitura de jogo e suporte tático para o time.",
            foco_treino: ["Sincronizar flashes com a entrada do duelista", "Aumentar a agressividade em situações de vantagem numérica"],
            tatico: "Use suas habilidades de reconhecimento para limpar cantos comuns antes do entry.",
            nota_coach: "7.8"
        }
    },
    {
        player_id: 'm4sna#chama',
        insight: {
            diagnostico_principal: "Performance equilibrada. Mantendo o KAST elevado e ajudando na economia do time.",
            foco_treino: ["Ajustar crosshair placement em níveis de altura variados", "Comunicação mais ativa durante o retake"],
            tatico: "Segure o posicionamento no Bomb B e evite dar o peak desnecessário após o plant.",
            nota_coach: "7.5"
        }
    },
    {
        player_id: 'DefeitoDeFábrica#ZzZ',
        insight: {
            diagnostico_principal: "Sentinela resiliente. Excelente controle de flanco e retenção de área.",
            foco_treino: ["Variar o posicionamento de traps para evitar pre-fire", "Treinar trigger discipline em situações de lurk"],
            tatico: "Mantenha a vigilância no flanco durante ataques rápidos e comunique imediatamente qualquer movimento.",
            nota_coach: "8.0"
        }
    }
];

async function restore() {
    console.log(`🛠️ [VIP-RESTORE] Restaurando laudos de elite para partida: ${matchId}`);
    
    for (const item of insights) {
        console.log(`📤 Inserindo laudo para: ${item.player_id}`);
        
        const data = {
            match_id: matchId,
            player_id: item.player_id,
            insight_resumo: item.insight,
            model_used: 'Oráculo-VIP-Elite (Manual Recovery)'
        };

        // Oráculo-V
        await supabase.from('ai_insights').upsert([data], { onConflict: 'match_id,player_id' });
        
        // Protocolo-V
        if (supabaseProtocol) {
            await supabaseProtocol.from('ai_insights').upsert([data], { onConflict: 'match_id,player_id' });
        }
        
        // Finalizar Job na fila
        await supabase.from('match_analysis_queue')
            .update({ status: 'completed', error_message: null })
            .eq('match_id', matchId)
            .eq('agente_tag', item.player_id);
    }
    
    console.log("✅ [SUCESSO] Todos os laudos de elite foram restaurados com sucesso.");
}

restore();
