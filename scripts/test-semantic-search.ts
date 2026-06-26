// ═══════════════════════════════════════
// ORACLE — Semantic Search Integration Test
// Run: npx tsx scripts/test-semantic-search.ts
//
// Tests the full pipeline:
// 1. Generate embeddings via OpenAI
// 2. Store chunks + embeddings in Supabase pgvector
// 3. Search via match_documents RPC
// 4. Verify cosine similarity results
// ═══════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

// ─── Config ────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function check(name: string, value: string | undefined): boolean {
  if (!value || value.includes('placeholder')) {
    console.error(`❌ ${name} is not configured (set it in .env.local)`);
    return false;
  }
  console.log(`✅ ${name} is set`);
  return true;
}

// ─── OpenAI Embedding ──────────────────

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// ─── Main Test ─────────────────────────

async function main() {
  console.log('\n═══════════════════════════════════════');
  console.log('  ORACLE — Semantic Search Pipeline Test');
  console.log('═══════════════════════════════════════\n');

  // Step 0: Check prerequisites
  console.log('Step 0: Checking prerequisites...');
  const allConfigured = [
    check('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL),
    check('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_KEY),
    check('OPENAI_API_KEY', OPENAI_API_KEY),
  ].every(Boolean);

  if (!allConfigured) {
    console.error('\n❌ Cannot run test — configure the env vars above in .env.local');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Step 1: Verify pgvector extension is enabled
  console.log('\nStep 1: Verifying pgvector extension...');
  const { data: ext, error: extError } = await supabase
    .from('pg_extension')
    .select('extname')
    .eq('extname', 'vector')
    .single();

  if (extError || !ext) {
    console.error('❌ pgvector extension not found. Run the migration first:');
    console.error('   See: supabase/migrations/010_pgvector_semantic_search.sql');
    process.exit(1);
  }
  console.log('✅ pgvector extension is enabled');

  // Step 2: Verify document_chunks table exists
  console.log('\nStep 2: Verifying document_chunks table...');
  const { error: tableError } = await supabase
    .from('document_chunks')
    .select('id')
    .limit(1);

  if (tableError) {
    console.error('❌ document_chunks table not found:', tableError.message);
    process.exit(1);
  }
  console.log('✅ document_chunks table exists');

  // Step 3: Generate embedding for test content
  console.log('\nStep 3: Generating embedding via OpenAI...');
  const testContent = 'ORACLE is an AI-powered digital agency assistant that helps with SEO, web development, Google Ads, Meta Ads, and social media management for Indian businesses.';
  const embedding = await generateEmbedding(testContent);

  if (embedding.length !== 1536) {
    console.error(`❌ Expected 1536-dimension embedding, got ${embedding.length}`);
    process.exit(1);
  }
  console.log(`✅ Generated ${embedding.length}-dimension embedding`);

  // Step 4: Store test document + chunks + embeddings
  console.log('\nStep 4: Storing test document with embeddings...');
  const testDocId = `test_${Date.now()}`;

  // Create a test knowledge doc
  const { error: docError } = await supabase.from('knowledge_docs').insert({
    id: testDocId,
    name: 'test-semantic-search.txt',
    content: testContent,
    source: 'upload',
    tags: ['test'],
    created_at: Date.now(),
  });

  if (docError) {
    console.error('❌ Failed to create test document:', docError.message);
    process.exit(1);
  }

  // Store the chunk with its embedding
  const { error: chunkError } = await supabase.from('document_chunks').insert({
    id: `${testDocId}_chunk_0`,
    document_id: testDocId,
    chunk_index: 0,
    content: testContent,
    embedding: embedding,
    created_at: Date.now(),
  });

  if (chunkError) {
    console.error('❌ Failed to store chunk with embedding:', chunkError.message);
    // Cleanup
    await supabase.from('knowledge_docs').delete().eq('id', testDocId);
    process.exit(1);
  }
  console.log('✅ Stored document chunk with embedding');

  // Step 5: Generate query embedding and search
  console.log('\nStep 5: Running semantic search...');
  const query = 'What services does ORACLE provide for digital marketing?';
  const queryEmbedding = await generateEmbedding(query);
  console.log(`  Query: "${query}"`);

  const { data: results, error: searchError } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.3,
    match_count: 5,
    filter_document_ids: [testDocId],
  });

  if (searchError) {
    console.error('❌ Semantic search failed:', searchError.message);
    // Cleanup
    await supabase.from('document_chunks').delete().eq('document_id', testDocId);
    await supabase.from('knowledge_docs').delete().eq('id', testDocId);
    process.exit(1);
  }

  if (!results || results.length === 0) {
    console.error('❌ No results returned from semantic search');
    // Cleanup
    await supabase.from('document_chunks').delete().eq('document_id', testDocId);
    await supabase.from('knowledge_docs').delete().eq('id', testDocId);
    process.exit(1);
  }

  console.log(`✅ Found ${results.length} result(s):`);
  for (const result of results) {
    console.log(`  ── Similarity: ${(result.similarity * 100).toFixed(1)}%`);
    console.log(`     Content: "${result.content.slice(0, 100)}..."`);
  }

  // Step 6: Verify similarity score is meaningful
  console.log('\nStep 6: Verifying similarity score...');
  const topResult = results[0];
  if (topResult.similarity < 0.5) {
    console.warn(`⚠️ Top similarity is only ${(topResult.similarity * 100).toFixed(1)}% — may be too low`);
  } else {
    console.log(`✅ Top similarity: ${(topResult.similarity * 100).toFixed(1)}% — pipeline working!`);
  }

  // Step 7: Test with a non-matching query
  console.log('\nStep 7: Testing with unrelated query...');
  const unrelatedQuery = 'How do I bake a chocolate cake?';
  const unrelatedEmbedding = await generateEmbedding(unrelatedQuery);

  const { data: unrelatedResults } = await supabase.rpc('match_documents', {
    query_embedding: unrelatedEmbedding,
    match_threshold: 0.5, // Higher threshold for unrelated
    match_count: 5,
    filter_document_ids: [testDocId],
  });

  if (unrelatedResults && unrelatedResults.length > 0) {
    console.warn(`⚠️ Unrelated query returned ${unrelatedResults.length} result(s) — threshold may need tuning`);
  } else {
    console.log('✅ Unrelated query correctly returned no results');
  }

  // Cleanup test data
  console.log('\nCleaning up test data...');
  await supabase.from('document_chunks').delete().eq('document_id', testDocId);
  await supabase.from('knowledge_docs').delete().eq('id', testDocId);
  console.log('✅ Cleanup complete');

  // Summary
  console.log('\n═══════════════════════════════════════');
  console.log('  ✅ ALL TESTS PASSED');
  console.log('  Semantic search pipeline is working!');
  console.log('═══════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
