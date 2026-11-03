# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

1. **Ilustradores, Concept Artists e Diretores de Arte**:
   - Criadores que buscam refinar cenas iterativamente com controle sobre enquadramento, iluminação, estilo e composição, comparando variações lado a lado e evoluindo a imagem a partir da melhor alternativa de cada rodada.
2. **Desenvolvedores e Criadores Desktop Locais (Local-First)**:
   - Usuários que utilizam sua própria chave da API Google Gemini (`AIza...`) em uma aplicação desktop instalável (**Tauri v2**) ou servidor local, com persistência local em **SQLite** e arquivos `.png` salvos diretamente no sistema de arquivos do sistema operacional, sem dependência de containers externos, bancos em nuvem ou buckets remotos.

## Product Purpose

**Nano Banana Studio** é um estúdio interativo desktop e web (`Tauri v2` + `Next.js` + `SQLite`) para criação e refinamento multi-turno de imagens com **Google Nano Banana (`gemini-2.5-flash-image`)** e **Gemini (`gemini-2.5-flash`)**.

O produto existe para substituir a tentativa-e-erro de um único prompt estático por um fluxo de exploração estruturada em 4 variações simultâneas e histórico ramificado por projeto. O sucesso significa permitir que o criador:
- Gere 4 interpretações visuais a cada rodada (`1 Prompt Base + 3 Ênfases Dinâmicas do Gemini` em diferentes partes da cena);
- Selecione qualquer uma das 4 imagens geradas para carregar seu prompt específico e continuar iterando (com ou sem referência visual `inlineData`);
- Navegue livremente por todo o histórico de interações do projeto, criando ramificações a partir de qualquer interação anterior sem perder o rastreio de origem;
- Tenha todas as imagens salvas automaticamente como arquivos `.png` organizados por pasta de projeto no computador (`~/Pictures/nanobanana/<nome-do-projeto>/`).

## Positioning

Diferente de geradores text-to-image convencionais que produzem uma única saída linear ou variações com a mesma instrução textual, o **Nano Banana Studio** combina:
1. **Expansão Dinâmica de Cena (`1 + 3`)**: O `gemini-2.5-flash` analisa os elementos da cena descrita pelo usuário e formula 3 versões adicionais do prompt dando ênfase criativa a partes distintas da cena, gerando as 4 imagens em paralelo via `gemini-2.5-flash-image`.
2. **Linhagem Ramificada de Interações**: Cada nova geração registra de qual interação anterior ela partiu (`parent_turn_number`), exibindo indicadores visuais de origem (`de #X ➔`) na linha do tempo superior.
3. **Arquitetura Local-First (SQLite + Filesystem Nativo)**: O banco SQLite armazena exclusivamente metadados, prompts e caminhos de arquivo (`image_path`), enquanto os binários `.png` residem diretamente no diretório configurável do usuário (`~/Pictures/nanobanana/<nome-do-projeto>/`), sincronizando renomeações de projeto com a pasta no disco e preservando os arquivos mesmo quando um projeto é removido da galeria.

## Operating Context

- **Aplicação Desktop Full-Viewport (`100vw × 100vh`, Zero-Scroll)**:
  - Opera em janela fixa sem rolagem de página, dividida em barra superior de `15%` (linha do tempo de interações no Studio; último projeto trabalhado, busca e filtros por categoria na Galeria), área central de `85%` (no Studio: grade `2×2` de geração ativa em `60%` à esquerda + painel de prompt e parâmetros em `40%` à direita; na Galeria: grade de cards de projetos) e barra inferior com nome editável do projeto à esquerda e botão `+ Novo Projeto` à direita.
- **Inspeção e Seleção no Fluxo de Trabalho**:
  - Clique simples em um dos 4 cards seleciona a variação (`✓ Escolhida`) e carrega seu prompt no editor lateral; o botão `⤢` (ou duplo-clique) abre a imagem em tela cheia (Lightbox).
  - O toggle `Referência Visual: ON / OFF` define se a imagem escolhida é enviada como `inlineData` para guiar a próxima rodada.

## Capabilities and Constraints

- **Modelos Utilizados**:
  - `gemini-2.5-flash` para análise da cena e geração das 3 variações de prompt com ênfases dinâmicas.
  - `gemini-2.5-flash-image` para geração paralela das 4 imagens (e refinamento multimodal quando `Referência Visual` está ativa).
- **Armazenamento de Imagens no Filesystem**:
  - Diretório padrão: `~/Pictures/nanobanana/<nome-do-projeto>/` (configurável no modal `⚙ Config` via chave `images_output_dir` na tabela `app_vault`).
  - Nenhuma imagem em base64 (`image_data_url`) é persistida no SQLite; o banco guarda apenas `image_path` e `variants_json` apontando para os caminhos locais, servidos via `/api/image?path=...`.
  - Novos projetos iniciam com os 4 slots vazios (sem imagens mockadas).
- **Persistência SQLite (`~/.local/share/com.nanobanana.studio/nanobanana.sqlite3`)**:
  - Tabelas: `users`, `conversations`, `conversation_turns` (incluindo `variants_json` e `parent_turn_number`) e `app_vault`.
  - Excluir um projeto na Galeria remove os registros do SQLite, mas preserva intencionalmente a pasta e os arquivos `.png` em `~/Pictures/nanobanana/`.
- **Gerenciamento de Chave de API (`AIza...`)**:
  - Configurável no modal `⚙ Config`, com opção ativada por padrão para persistir localmente no `app_vault` do SQLite do usuário.

## Brand Commitments

- **Identidade**: **Nano Banana Studio** (`NANOBANANA // STUDIO`).
- **Idioma da Interface**: Português (`pt-BR`).
- **Restrições Visuais Vinculantes Definidas pelo Usuário**:
  - Paleta de 5 cores obrigatória: `["#003049", "#d62828", "#f77f00", "#fcbf49", "#eae2b7"]`.
  - Divisores estruturais entre seções da tela no lugar de containers em card; o uso de cards é restrito exclusivamente aos projetos na Galeria, às 4 imagens geradas no grid `2×2` e a cada item de interação da timeline.

## Evidence on Hand

- **Código-Fonte e Rotas Ativas**:
  - Estúdio Interativo em `frontend/src/features/studio/components/InteractiveStudio.tsx` (`/` e `/create`).
  - Galeria de Projetos em `frontend/src/app/gallery/page.tsx` (`/gallery`).
  - Cliente Gemini / Nano Banana em `frontend/src/features/studio/services/nanobananaClient.ts`.
  - Persistência SQLite e gerenciamento de pastas no filesystem em `frontend/src/app/api/db/route.ts` e `src-tauri/src/db.rs`.
  - Streaming local de imagens em `frontend/src/app/api/image/route.ts`.
- **Ausências Confirmadas (Não Fabricar)**:
  - Sem depoimentos de clientes, métricas comerciais externas, planos de preços ou infraestrutura multi-tenant em nuvem.

## Product Principles

1. **Exploração Paralela sobre Tentativa Linear**: Sempre oferecer ao criador 4 interpretações reais da cena (`1 Base + 3 Ênfases Dinâmicas do Gemini`) em vez de forçar ajustes cegos em uma única imagem por vez.
2. **Propriedade Real dos Arquivos (Filesystem-First)**: As imagens geradas pertencem diretamente às pastas do usuário em `~/Pictures/nanobanana/<projeto>/`, legíveis fora do aplicativo e preservadas mesmo se o projeto for removido da listagem.
3. **Rastreabilidade Não-Destrutiva**: Toda iteração preserva sua linhagem (`parent_turn_number`), permitindo voltar a qualquer ponto da história, inspecionar as 4 variações daquela rodada e abrir novos ramos criativos.
4. **Foco Total na Tela (`100vw × 100vh` Zero-Scroll)**: Toda a operação criativa — linha do tempo, grade `2×2` de geração e controles de prompt/parâmetros — deve caber e responder dentro do viewport fixo sem barras de rolagem de página.
