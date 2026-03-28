# Integração Frontend: Protocolo-V (Dashboard)

A nova arquitetura *Dual-Base* (Oráculo v4.0) criou e preencheu a tabela `ai_insights` no banco de operações público do **Protocolo-V**, contendo feedbacks narrativos (JSON) extraídos das LLMs de ponta.

Para que as análises deixem o limbo do backend e apareçam no seu portal, você deverá implementar ler e exibir esses dados no projeto Frontend. Abaixo, você encontra a receita exata de implementação para copiar, colar e ajustar no seu Frontend (possivelmente React/NextJS).

---

## Passo 1: O Que Obter (Consulta SQL/Supabase)

Na tela onde as partições/rounds são exibidos (Ex: `[matchId].tsx`, ou componente de detalhes de Partida):

Você precisará realizar um **fetch paralelo** na nova tabela quando a tela montar as estatísticas do jogador. O código do seu Supabase Client deve ficar assim:

```javascript
// Exemplo em componente React consumindo o Supabase Client do Protocolo-V
const fetchAiInsight = async (playerId, matchId) => {
    const { data, error } = await supabase
        .from('ai_insights')
        .select('insight_resumo, model_used, created_at')
        .eq('player_id', playerId)   // ex: ousadia#013
        .eq('match_id', matchId)     // UUID da partida pesquisada
        .single(); // Esperamos 1 único conselho por mix partida/jogador

    if (error && error.code !== 'PGRST116') { // Ignorar erro "0 rows" quando n tiver
       console.error("Erro ao buscar Laudo de IA:", error);
       return null;
    }
    return data; 
};
```

---

## Passo 2: Estrutura do Objeto (O Payload Original)
O retorno (`data.insight_resumo`) da consulta acima entregará o seguinte objeto padronizado pelo motor **Python -> Ollama**:

```json
{
  "tatico": "Focou excessivamente em entry-frags na Bind ao invés de buscar espaço; sua Raze morreu isolada.",
  "nota_coach": 4,
  "foco_treino": [
    "Praticar a positioning no começo de cada rodada.",
    "Acompanhar flashes da Skye antes de voar de C4."
  ],
  "diagnostico_principal": "Falta de paciência para escalar com o time penalizando a eficiência ofensiva."
}
```

---

## Passo 3: O Componente Visual "Head Coach"

Abaixo segue um modelo visual limpo e minimalista para você inserir na interface do usuário (UI) da partida. Substitua a mecânica visual ou de estilo Tailwind conforme o *branding* do Protocolo-V.

```tsx
// AiInsightCard.tsx
import React from 'react';

export default function AiInsightCard({ insightData }) {
    if (!insightData || !insightData.insight_resumo) {
        return (
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg text-gray-400 text-sm text-center">
                Análise de Inteligência Artificial ainda não processada para esta partida.
            </div>
        );
    }

    const { insight_resumo, model_used } = insightData;

    return (
        <div className="p-6 bg-gradient-to-b from-gray-900 to-black border border-blue-900 rounded-xl shadow-lg mt-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold font-mono text-blue-400">🤖 ORÁCULO A.I. HEAD COACH</h3>
                <span className="px-3 py-1 bg-blue-900/30 text-blue-300 text-xs rounded-full border border-blue-800">
                    Nota Final: {insight_resumo.nota_coach} / 10
                </span>
            </div>

            <div className="space-y-4">
                {/* Diagnóstico Breve */}
                <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Diagnóstico</h4>
                    <p className="text-gray-200 text-sm leading-relaxed">{insight_resumo.diagnostico_principal}</p>
                </div>

                {/* Análise Tática Profunda */}
                <div className="bg-blue-950/20 p-4 rounded-md border border-blue-900/30">
                    <h4 className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-2">Avaliação Tática</h4>
                    <p className="text-gray-300 text-sm italic">"{insight_resumo.tatico}"</p>
                </div>

                {/* Bullets de Treino */}
                {insight_resumo.foco_treino && insight_resumo.foco_treino.length > 0 && (
                    <div>
                        <h4 className="text-xs font-semibold text-yellow-500 uppercase tracking-wider mb-2">Foco de Treino Rescrito</h4>
                        <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
                            {insight_resumo.foco_treino.map((dica, idx) => (
                                <li key={idx} className="marker:text-yellow-600">{dica}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-800 text-right">
                <span className="text-[10px] text-gray-600 font-mono">Processado por: {model_used}</span>
            </div>
        </div>
    );
}

```

---

## Resumo das Alterações Frontend (Checklist):
1. [ ] Atualizar as permissões (RLS) da tabela `ai_insights` no Supabase do Protocolo-V (se necessário, permita leitura anônima/pública com `CREATE POLICY "Enable read access for all users" ON "public"."ai_insights" AS PERMISSIVE FOR SELECT TO public USING (true)`).
2. [ ] Editar a página/componente da partida.
3. [ ] Criar o componente de renderização do `AiInsightCard`.
4. [ ] Passar os props e garantir exibição estática maravilhosa.
