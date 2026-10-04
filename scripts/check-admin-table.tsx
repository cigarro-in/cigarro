import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataTable } from '../src/adminnew/components/shared/DataTable';

// tsx's script runner uses classic JSX for files outside the app compilation.
// Supply React to that isolated runtime without changing production components.
Object.assign(globalThis, { React });

const rows = [
  { id: 'a', name: 'Reserve', brand: { name: 'Cigarro' } },
  { id: 'b', name: 'Midnight', brand: { name: 'Other' } },
];
const columns = [{ key: 'name', label: 'Product' }];
const render = (props: Partial<Parameters<typeof DataTable<(typeof rows)[number]>>[0]> = {}) =>
  renderToStaticMarkup(<DataTable data={rows} columns={columns} {...props} />);

assert.match(render({ searchTerm: ' reserve ' }), /Reserve/);
assert.doesNotMatch(render({ searchTerm: ' reserve ' }), /Midnight/);
assert.match(render({ searchTerm: 'cigarro', searchText: (row) => `${row.name} ${row.brand.name}` }), /Reserve/);
assert.match(render({ searchTerm: 'missing' }), /No results/);
assert.doesNotMatch(render({ loading: true }), /Reserve/);
const selectable = render({ selectedItems: ['a'], onSelectionChange: () => undefined });
assert.match(selectable, /Select visible rows/);
assert.match(selectable, /data-state="indeterminate"/);
assert.match(render({ selectedItems: ['a', 'b'], onSelectionChange: () => undefined }), /aria-checked="true"/);
console.log('Admin table rendering checks passed');
