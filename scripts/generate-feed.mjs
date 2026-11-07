#!/usr/bin/env node
/**
 * Build feed.xml from published posts in Supabase.
 *
 * Usage:
 *   node scripts/generate-feed.mjs
 *
 * Optional environment variables:
 *   SUPABASE_URL        (defaults to the project used by the site)
 *   SUPABASE_ANON_KEY   (defaults to the public anon key shipped with the site)
 *
 * The anon key is public by design; it can only read rows allowed by RLS.
 * If the posts table does not exist yet, the script writes a valid empty feed
 * instead of failing the workflow.
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SITE_URL = 'https://pecellc.github.io/esyn';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ziibivkhualutrdiojto.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppaWJpdmtodWFsdXRyZGlvanRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTE0NzgsImV4cCI6MjEwODY2NzQ3OH0.2kJM7uNIMxodj9GRU9B3QvLA7NZc2JjuUMN5U-i3-Z0';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'feed.xml');

function xml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function plain(value) {
  return String(value == null ? '' : value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function rfcDate(value) {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

function itemDescription(post) {
  const text = plain(post.excerpt) || plain(post.body);
  if (!text) return '';
  return text.length > 320 ? text.slice(0, 317).trimEnd() + '…' : text;
}

async function loadPosts() {
  const url = new URL('/rest/v1/posts', SUPABASE_URL);
  url.searchParams.set('select', 'slug,title,excerpt,body,kind,published_at,updated_at');
  url.searchParams.set('published', 'eq.true');
  url.searchParams.set('order', 'published_at.desc.nullslast');

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
      Accept: 'application/json'
    }
  });

  if (!res.ok) {
    throw new Error('Supabase returned ' + res.status + ' ' + res.statusText);
  }

  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

function buildFeed(posts) {
  const items = posts.map((post) => {
    const link = SITE_URL + '/#/journal/' + encodeURIComponent(post.slug || '');
    const date = post.published_at || post.updated_at || new Date().toISOString();
    const description = itemDescription(post);
    return [
      '    <item>',
      '      <title>' + xml(post.title) + '</title>',
      '      <link>' + xml(link) + '</link>',
      '      <guid isPermaLink="false">' + xml('exyn:' + (post.slug || post.title)) + '</guid>',
      '      <pubDate>' + xml(rfcDate(date)) + '</pubDate>',
      '      <category>' + xml(post.kind === 'now' ? 'Now' : 'Journal') + '</category>',
      description ? '      <description>' + xml(description) + '</description>' : '',
      '    </item>'
    ].filter(Boolean).join('\n');
  });

  const lastBuild = posts.length
    ? rfcDate(posts[0].published_at || posts[0].updated_at)
    : new Date().toUTCString();

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>exyn — notes by Excel Adila Putra</title>',
    '    <link>' + SITE_URL + '/</link>',
    '    <description>Journal notes, small updates, and what I am up to right now.</description>',
    '    <language>en</language>',
    '    <lastBuildDate>' + xml(lastBuild) + '</lastBuildDate>',
    '    <atom:link href="' + SITE_URL + '/feed.xml" rel="self" type="application/rss+xml"/>',
    items.length ? items.join('\n') : '    <!-- No published posts yet. -->',
    '  </channel>',
    '</rss>',
    ''
  ].join('\n');
}

let posts = [];
try {
  posts = await loadPosts();
  console.log('Loaded ' + posts.length + ' published post(s).');
} catch (error) {
  console.warn('Could not load posts (' + error.message + '). Writing an empty feed.');
}

await writeFile(OUT, buildFeed(posts), 'utf8');
console.log('Wrote ' + OUT);
