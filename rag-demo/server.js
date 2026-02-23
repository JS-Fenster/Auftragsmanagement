require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Kategorien-Liste (wird beim Start geladen) ─────────────────
let KATEGORIE_LIST = [];

async function loadKategorien() {
  const { data, error } = await supabase.rpc('exec_sql', {
    query: "SELECT kategorie, COUNT(*)::int as count FROM documents WHERE kategorie IS NOT NULL GROUP BY kategorie ORDER BY count DESC"
  });
  if (!error && data) {
    KATEGORIE_LIST = data;
  } else {
    let allKats = [];
    let offset = 0;
    const batchSize = 1000;
    while (true) {
      const { data: batch, error: bErr } = await supabase
        .from('documents')
        .select('kategorie')
        .not('kategorie', 'is', null)
        .range(offset, offset + batchSize - 1);
      if (bErr || !batch || batch.length === 0) break;
      allKats = allKats.concat(batch);
      if (batch.length < batchSize) break;
      offset += batchSize;
    }
    const counts = {};
    allKats.forEach(d => { counts[d.kategorie] = (counts[d.kategorie] || 0) + 1; });
    KATEGORIE_LIST = Object.entries(counts)
      .map(([k, v]) => ({ kategorie: k, count: v }))
      .sort((a, b) => b.count - a.count);
  }
}

// ─── Tool Definition fuer Agent-Modus ───────────────────────────
function getSearchTool() {
  const kategorien = KATEGORIE_LIST.map(k => k.kategorie);
  return {
    type: 'function',
    function: {
      name: 'search_documents',
      description: 'Durchsucht die Dokumenten-Datenbank von JS Fenster & Tueren mittels Vektorsuche mit optionalen Filtern. Kann mehrfach mit verschiedenen Parametern aufgerufen werden um bessere Ergebnisse zu finden.',
      parameters: {
        type: 'object',
        properties: {
          search_query: {
            type: 'string',
            description: 'Fokussierte Suchbegriffe (max 10 Woerter). Semantisch relevant, keine Fuellwoerter.'
          },
          kategorie: {
            type: 'string',
            enum: kategorien,
            description: 'Exakte Dokumentkategorie zum Filtern.'
          },
          aussteller: {
            type: 'string',
            description: 'Firmenname oder Teil davon. Wird in aussteller_firma, ocr_text und email_betreff gesucht.'
          },
          datum_von: {
            type: 'string',
            description: 'Startdatum im Format YYYY-MM-DD.'
          },
          datum_bis: {
            type: 'string',
            description: 'Enddatum im Format YYYY-MM-DD.'
          },
          fulltext: {
            type: 'string',
            description: 'Exaktes Stichwort das im Dokumenttext vorkommen muss (Produktnamen, Systeme, Nummern).'
          },
          k: {
            type: 'integer',
            description: 'Anzahl der Treffer (1-20). Standard: 5.',
            minimum: 1,
            maximum: 20
          }
        },
        required: ['search_query']
      }
    }
  };
}

// ─── Suchfunktion (shared zwischen allen Modi) ──────────────────
async function executeSearch(params) {
  const { search_query, kategorie, aussteller, datum_von, datum_bis, fulltext, k = 5 } = params;
  const clampedK = Math.min(Math.max(parseInt(k) || 5, 1), 20);

  // Embed
  const embStart = Date.now();
  const embResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: search_query,
  });
  const embDuration = Date.now() - embStart;
  const queryEmbedding = embResponse.data[0].embedding;

  // Search
  const searchStart = Date.now();
  const hasFilters = kategorie || aussteller || datum_von || datum_bis || fulltext;
  let chunks, rpcError;

  if (hasFilters) {
    const rpcParams = { query_embedding: queryEmbedding, match_count: clampedK };
    if (kategorie) rpcParams.filter_kategorie = kategorie;
    if (aussteller) rpcParams.filter_aussteller = aussteller;
    if (datum_von) rpcParams.filter_datum_von = datum_von;
    if (datum_bis) rpcParams.filter_datum_bis = datum_bis;
    if (fulltext) rpcParams.filter_fulltext = fulltext;

    const result = await supabase.rpc('match_document_embeddings_hybrid', rpcParams);
    chunks = result.data;
    rpcError = result.error;

    // Fallback: remove fulltext
    if (!rpcError && (!chunks || chunks.length === 0) && fulltext) {
      delete rpcParams.filter_fulltext;
      const fb = await supabase.rpc('match_document_embeddings_hybrid', rpcParams);
      chunks = fb.data;
      rpcError = fb.error;
    }
    // Fallback: pure vector
    if (!rpcError && (!chunks || chunks.length === 0)) {
      const fb2 = await supabase.rpc('match_document_embeddings', {
        query_embedding: queryEmbedding, match_count: clampedK
      });
      chunks = fb2.data;
      rpcError = fb2.error;
    }
  } else {
    const result = await supabase.rpc('match_document_embeddings', {
      query_embedding: queryEmbedding, match_count: clampedK
    });
    chunks = result.data;
    rpcError = result.error;
  }
  const searchDuration = Date.now() - searchStart;

  if (rpcError) throw rpcError;

  // Enrich
  const docIds = [...new Set((chunks || []).map(c => c.document_id))];
  let docMap = {};
  if (docIds.length > 0) {
    const { data: docs } = await supabase
      .from('documents')
      .select('id, kategorie, aussteller_firma, email_betreff, source, dokument_datum, dokument_nummer')
      .in('id', docIds);
    if (docs) docs.forEach(d => { docMap[d.id] = d; });
  }

  const enriched = (chunks || []).map(c => ({
    ...c,
    kategorie: docMap[c.document_id]?.kategorie || null,
    aussteller_firma: docMap[c.document_id]?.aussteller_firma || null,
    email_betreff: docMap[c.document_id]?.email_betreff || null,
    source: docMap[c.document_id]?.source || null,
    dokument_datum: docMap[c.document_id]?.dokument_datum || null,
    dokument_nummer: docMap[c.document_id]?.dokument_nummer || null,
  }));

  return {
    chunks: enriched,
    debug: {
      search_query,
      filters: { kategorie, aussteller, datum_von, datum_bis, fulltext },
      k: clampedK,
      results: enriched.length,
      embedding_tokens: embResponse.usage.total_tokens,
      embedding_ms: embDuration,
      search_ms: searchDuration,
      mode: hasFilters ? 'hybrid' : 'vector',
      chunks: enriched.map((c, i) => ({
        rank: i + 1,
        similarity: (c.similarity * 100).toFixed(2) + '%',
        document_id: c.document_id,
        chunk_index: c.chunk_index,
        kategorie: c.kategorie,
        source: c.source,
        aussteller_firma: c.aussteller_firma,
        email_betreff: c.email_betreff,
        dokument_datum: c.dokument_datum,
        dokument_nummer: c.dokument_nummer,
        token_count: c.token_count,
        text_preview: c.chunk_text.substring(0, 200) + (c.chunk_text.length > 200 ? '...' : ''),
      })),
    },
  };
}

// ─── GET /api/documents ─────────────────────────────────────────
app.get('/api/documents', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const search = (req.query.search || '').trim();
    const kategorie = (req.query.kategorie || '').trim();

    let query = supabase
      .from('documents')
      .select('id, kategorie, aussteller_firma, dokument_datum, dokument_url, source, email_betreff, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (kategorie) query = query.eq('kategorie', kategorie);
    if (search) query = query.or(`aussteller_firma.ilike.%${search}%,email_betreff.ilike.%${search}%,dokument_nummer.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ documents: data, total: count, limit, offset });
  } catch (err) {
    console.error('GET /api/documents error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/documents/:id ─────────────────────────────────────
app.get('/api/documents/:id', async (req, res) => {
  try {
    const { data: doc, error } = await supabase
      .from('documents')
      .select('id, kategorie, aussteller_firma, dokument_datum, dokument_url, dokument_full_url, source, email_betreff, email_body_text, ocr_text, created_at, email_von_email, email_von_name, email_an_liste, email_empfangen_am, dokument_nummer, summe_brutto, summe_netto, empfaenger_firma, empfaenger_vorname, empfaenger_nachname, inhalt_zusammenfassung')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;

    let previewUrl = null;
    if (doc.dokument_url) {
      const { data: signedData, error: signErr } = await supabase
        .storage.from('documents').createSignedUrl(doc.dokument_url, 300);
      if (!signErr && signedData) previewUrl = signedData.signedUrl;
    }
    res.json({ document: doc, previewUrl });
  } catch (err) {
    console.error('GET /api/documents/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/rag/chat ─────────────────────────────────────────
app.post('/api/rag/chat', async (req, res) => {
  try {
    const { question, k = 5, mode = 'agent' } = req.body;
    if (!question) return res.status(400).json({ error: 'question is required' });

    const clampedK = Math.min(Math.max(parseInt(k) || 5, 1), 20);

    // ─── AGENT MODE: Tool Use Loop ──────────────────────────────
    if (mode === 'agent') {
      return await handleAgentMode(req, res, question, clampedK);
    }

    // ─── HYBRID MODE: Programmatic extraction + search ──────────
    if (mode === 'hybrid') {
      return await handleHybridMode(req, res, question, clampedK);
    }

    // ─── VECTOR MODE: Pure vector search ────────────────────────
    return await handleVectorMode(req, res, question, clampedK);
  } catch (err) {
    console.error('POST /api/rag/chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Agent Mode Handler ─────────────────────────────────────────
async function handleAgentMode(req, res, question, k) {
  const startTime = Date.now();
  const iterations = [];
  const MAX_ITERATIONS = 5;
  let totalTokens = { prompt: 0, completion: 0 };

  const kategorienStr = KATEGORIE_LIST.map(k => k.kategorie).join(', ');

  const systemPrompt = `Du bist ein erfahrener und hartnäckiger Dokumenten-Rechercheur fuer JS Fenster & Tueren. Du hast Zugriff auf eine Dokumentendatenbank mit ${KATEGORIE_LIST.reduce((s, k) => s + k.count, 0)} Dokumenten in ${KATEGORIE_LIST.length} Kategorien.

Verfuegbare Kategorien: ${kategorienStr}

WICHTIGE REGELN:
1. Nutze das search_documents Tool um Dokumente zu finden. Du kannst es MEHRFACH aufrufen.
2. Wenn der erste Versuch nicht die gewuenschten Ergebnisse liefert, passe die Suchparameter an und versuche es erneut:
   - Andere Suchbegriffe (Synonyme, verwandte Begriffe)
   - Weniger oder andere Filter
   - Breiterer Datumsbereich
   - Ohne fulltext-Filter (der ist am restriktivsten)
   - Hoeheres k fuer mehr Treffer
3. Gib NICHT auf nach einem Versuch. Verhalte dich wie ein motivierter Bibliothekar.
4. Loese Synonyme auf: "polnischer Lieferant aus Bytow" → suche nach "Drutex"
5. Wenn du das gesuchte Dokument gefunden hast, gib eine praezise Antwort mit Dokumentnummer, Datum und relevanten Details.
6. Verweise in der Antwort auf die Quellen.

Dein Ziel: Finde die bestmoegliche Antwort, auch wenn es mehrere Suchanlaeufe braucht.`;

  let messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question },
  ];

  const tools = [getSearchTool()];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const iterStart = Date.now();

    const response = await openai.chat.completions.create({
      model: 'gpt-5.2-chat-latest',
      messages,
      tools,
      max_completion_tokens: 2000,
    });

    const choice = response.choices[0];
    const usage = response.usage;
    totalTokens.prompt += usage.prompt_tokens;
    totalTokens.completion += usage.completion_tokens;

    // If GPT wants to call a tool
    if (choice.finish_reason === 'tool_calls' || (choice.message.tool_calls && choice.message.tool_calls.length > 0)) {
      messages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        args.k = args.k || k;

        const searchResult = await executeSearch(args);

        // Build a concise result for GPT
        const resultText = searchResult.chunks.length === 0
          ? 'Keine Treffer gefunden.'
          : searchResult.chunks.map((c, idx) => {
              const meta = [
                c.kategorie,
                c.aussteller_firma,
                c.dokument_datum,
                c.dokument_nummer ? `Nr:${c.dokument_nummer}` : null,
              ].filter(Boolean).join(' | ');
              return `[${idx + 1}] Similarity: ${(c.similarity * 100).toFixed(1)}% | ${meta}\n${c.chunk_text.substring(0, 500)}`;
            }).join('\n\n---\n\n');

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: `${searchResult.chunks.length} Treffer (Modus: ${searchResult.debug.mode}):\n\n${resultText}`,
        });

        iterations.push({
          iteration: i + 1,
          tool_call: args,
          duration_ms: Date.now() - iterStart,
          search_debug: searchResult.debug,
        });
      }
    }
    // If GPT gives a final answer
    else if (choice.finish_reason === 'stop') {
      const answer = choice.message.content;
      const totalDuration = Date.now() - startTime;

      // Cost calculation
      const inputCost = (totalTokens.prompt / 1_000_000) * 1.75;
      const outputCost = (totalTokens.completion / 1_000_000) * 14.00;
      const embTokens = iterations.reduce((s, it) => s + (it.search_debug?.embedding_tokens || 0), 0);
      const embCost = (embTokens / 1_000_000) * 0.02;

      const debug = {
        mode: 'agent',
        iterations,
        iteration_count: iterations.length,
        total_duration_ms: totalDuration,
        tokens: {
          prompt: totalTokens.prompt,
          completion: totalTokens.completion,
          total: totalTokens.prompt + totalTokens.completion,
          embedding: embTokens,
        },
        cost_estimate: {
          llm_input: '$' + inputCost.toFixed(6),
          llm_output: '$' + outputCost.toFixed(6),
          embedding: '$' + embCost.toFixed(6),
          total: '$' + (inputCost + outputCost + embCost).toFixed(6),
        },
      };

      return res.json({ answer, debug, question });
    }
  }

  // Max iterations reached
  const totalDuration = Date.now() - startTime;
  return res.json({
    answer: 'Maximale Anzahl Suchversuche erreicht. Bitte versuche eine praezisere Frage.',
    debug: {
      mode: 'agent',
      iterations,
      iteration_count: iterations.length,
      total_duration_ms: totalDuration,
      max_iterations_reached: true,
    },
    question,
  });
}

// ─── Hybrid Mode Handler ────────────────────────────────────────
async function handleHybridMode(req, res, question, k) {
  const startTime = Date.now();
  const debug = {};
  const kategorienStr = KATEGORIE_LIST.map(k => k.kategorie).join(', ');

  // Extract filters
  const extractStart = Date.now();
  const extractResponse = await openai.chat.completions.create({
    model: 'gpt-5.2-chat-latest',
    messages: [
      {
        role: 'system',
        content: `Du bist ein Query-Extraktor. Analysiere die Frage und extrahiere Filter.
Verfuegbare Kategorien: ${kategorienStr}
Antworte NUR mit JSON:
{"search_query":"fokussierte begriffe","kategorie":null,"aussteller":null,"datum_von":null,"datum_bis":null,"fulltext":null}
Regeln: search_query max 10 Woerter. Synonyme aufloesen. Kategorien exakt aus Liste.`
      },
      { role: 'user', content: question }
    ],
    max_completion_tokens: 300,
  });
  const extractDuration = Date.now() - extractStart;
  const rawExtract = extractResponse.choices[0].message.content;

  let parsed;
  try {
    parsed = JSON.parse(rawExtract.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
  } catch (e) {
    parsed = { search_query: question };
  }

  const searchParams = {
    search_query: parsed.search_query || question,
    kategorie: parsed.kategorie || undefined,
    aussteller: parsed.aussteller || undefined,
    datum_von: parsed.datum_von || undefined,
    datum_bis: parsed.datum_bis || undefined,
    fulltext: parsed.fulltext || undefined,
    k,
  };

  debug.extraction = {
    model: 'gpt-5.2-chat-latest',
    duration_ms: extractDuration,
    tokens: extractResponse.usage,
    original_question: question,
    search_query: searchParams.search_query,
    filters: { kategorie: searchParams.kategorie, aussteller: searchParams.aussteller, datum_von: searchParams.datum_von, datum_bis: searchParams.datum_bis, fulltext: searchParams.fulltext },
    raw_response: rawExtract,
  };

  // Search
  const searchResult = await executeSearch(searchParams);
  debug.search = searchResult.debug;

  // Answer
  const context = searchResult.chunks.map((c, i) =>
    `[Chunk ${i + 1} | ${(c.similarity * 100).toFixed(1)}% | ${c.kategorie || '?'} | ${c.aussteller_firma || c.email_betreff || '?'} | ${c.dokument_datum || '?'} | Nr:${c.dokument_nummer || '?'}]\n${c.chunk_text}`
  ).join('\n\n---\n\n');

  const chatStart = Date.now();
  const chatResponse = await openai.chat.completions.create({
    model: 'gpt-5.2-chat-latest',
    messages: [
      { role: 'system', content: 'Du bist ein hilfreicher Assistent fuer JS Fenster & Tueren. Antworte praezise basierend auf den Chunks. Verweise auf Quellen.' },
      { role: 'user', content: `Kontext:\n\n${context}\n\n---\nFrage: ${question}` },
    ],
    max_completion_tokens: 2000,
  });
  const chatDuration = Date.now() - chatStart;
  const usage = chatResponse.usage;

  const inputCost = (usage.prompt_tokens / 1_000_000) * 1.75;
  const outputCost = (usage.completion_tokens / 1_000_000) * 14.00;
  const extractCost = (extractResponse.usage.prompt_tokens / 1_000_000) * 1.75 + (extractResponse.usage.completion_tokens / 1_000_000) * 14.00;
  const embCost = (searchResult.debug.embedding_tokens / 1_000_000) * 0.02;

  debug.chat = {
    model: 'gpt-5.2-chat-latest',
    duration_ms: chatDuration,
    tokens: usage,
    cost_estimate: {
      extraction: '$' + extractCost.toFixed(6),
      embedding: '$' + embCost.toFixed(6),
      input: '$' + inputCost.toFixed(6),
      output: '$' + outputCost.toFixed(6),
      total: '$' + (extractCost + embCost + inputCost + outputCost).toFixed(6),
    },
  };
  debug.total_duration_ms = Date.now() - startTime;

  res.json({ answer: chatResponse.choices[0].message.content, debug, question });
}

// ─── Vector Mode Handler ────────────────────────────────────────
async function handleVectorMode(req, res, question, k) {
  const startTime = Date.now();
  const searchResult = await executeSearch({ search_query: question, k });

  const context = searchResult.chunks.map((c, i) =>
    `[Chunk ${i + 1} | ${(c.similarity * 100).toFixed(1)}% | ${c.kategorie || '?'} | ${c.aussteller_firma || c.email_betreff || '?'} | ${c.dokument_datum || '?'} | Nr:${c.dokument_nummer || '?'}]\n${c.chunk_text}`
  ).join('\n\n---\n\n');

  const chatStart = Date.now();
  const chatResponse = await openai.chat.completions.create({
    model: 'gpt-5.2-chat-latest',
    messages: [
      { role: 'system', content: 'Du bist ein hilfreicher Assistent fuer JS Fenster & Tueren. Antworte praezise basierend auf den Chunks. Verweise auf Quellen.' },
      { role: 'user', content: `Kontext:\n\n${context}\n\n---\nFrage: ${question}` },
    ],
    max_completion_tokens: 2000,
  });
  const chatDuration = Date.now() - chatStart;
  const usage = chatResponse.usage;

  const inputCost = (usage.prompt_tokens / 1_000_000) * 1.75;
  const outputCost = (usage.completion_tokens / 1_000_000) * 14.00;
  const embCost = (searchResult.debug.embedding_tokens / 1_000_000) * 0.02;

  const debug = {
    mode: 'vector',
    search: searchResult.debug,
    chat: {
      model: 'gpt-5.2-chat-latest',
      duration_ms: chatDuration,
      tokens: usage,
      cost_estimate: {
        embedding: '$' + embCost.toFixed(6),
        input: '$' + inputCost.toFixed(6),
        output: '$' + outputCost.toFixed(6),
        total: '$' + (embCost + inputCost + outputCost).toFixed(6),
      },
    },
    total_duration_ms: Date.now() - startTime,
  };

  res.json({ answer: chatResponse.choices[0].message.content, debug, question });
}

// ─── GET /api/kategorien ────────────────────────────────────────
app.get('/api/kategorien', async (req, res) => {
  try {
    if (KATEGORIE_LIST.length > 0) return res.json(KATEGORIE_LIST);
    await loadKategorien();
    res.json(KATEGORIE_LIST);
  } catch (err) {
    console.error('GET /api/kategorien error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3002;
loadKategorien().then(() => {
  app.listen(PORT, () => {
    console.log(`RAG Demo running on http://localhost:${PORT}`);
    console.log(`Kategorien geladen: ${KATEGORIE_LIST.length}`);
  });
});
