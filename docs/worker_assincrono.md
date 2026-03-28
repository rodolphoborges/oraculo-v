# Motor Tático Assíncrono (`worker.js`)

Este documento detalha o funcionamento interno da camada NodeJS responsável pela gestão da resiliência de fila e escalonamento assíncrono do Oráculo-V.

## 1. Topologia de Monitoramento (Loop Infinito)

O script `worker.js` opera em um laço ininterrupto (`while(true)`), consumindo a tabela `match_analysis_queue` configurada no Servidor de Operações local (Supabase).

> [!NOTE]
> Durante a execução local ou conteinerizada, ele aguarda **10 segundos** em stand-by caso a fila esteja vazia. Se for ativado via *GitHub Actions* (`process.env.GITHUB_ACTIONS === 'true'`), o Worker encerra de forma harmoniosa se não detectar novos jobs (poupando minutos computacionais da nuvem).

## 2. Padrão "Self-Healing" e Jobs Travados

Um dos grandes trunfos da arquitetura v4.0 é a capacidade de reanimar *Jobs* mortos ou zumbificação de rede. 
A fila considera as seguintes marcações na coluna `status`: `pending`, `processing`, `completed` ou `failed`.

### 2.1 Double Check de Concorrência
Quando um Job é movido de `pending` para `processing`, o Worker realiza uma revalidação condicional na atualização do ID (transação de atualização e filtro estrito `eq('status', 'pending')`) para garantir que nenhum outro processo rodando em multi-thread capture o mesmo bloco.

### 2.2 Sistema de Trava Temporária
Se o `worker.js` não encontrar um `pending` livre mas detectar o erro `PGRST116` (0 rows returned da fila pending), ocorre um **Fallback**:
Ele verifica se não existe um registro alocado em `processing` com carimbo de tempo (na coluna `processed_at`) estagnado há mais de 30 minutos. Se sim, ele automaticamente reseta o estado deste ID para `pending` - assumindo que a instância NodeJS anterior caiu sem completar o fluxo.

## 3. Dinâmica de Expansão (Módulo `AUTO`)

A API expõe o comando `AUTO` no lugar do nome de jogador padrão.
O Worker intercepta esta flag e suspende temporariamente a análise do Python. Ao invés disso, ele executa o módulo em lib de expansão tática, descobrindo no "Protocolo-V" todos os jogadores daquela partida atrelados sob o mesmo time cadastrado na Base. O motor então insere os demais Riot IDs em fila sob o mesmo `matchId`, multiplicando o output de análise de forma orgânica.

## 4. Integrações Extras
O script também trata dependências de API e feedback de notificação:
- Executa inicialização das predições via Holt-Winters consultando o passado das últimas três partidas, gravando estado no Protocolo-V (Dual-Base).
- Gera o *payload* final via API Bot Telegram (usando `TELEGRAM_BOT_TOKEN`) diretamente no *chat_id* do usuário com um laudo prévio e tendência.
