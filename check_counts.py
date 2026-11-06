#!/usr/bin/env python3
"""Audit completed participants, counterbalancing lists, and item x cell coverage.

Usage: python3 tools/check_counts.py /path/to/participant_csv_files
Outputs in current working directory:
  list_counts.csv, condition_counts.csv, item_cell_counts.csv
"""
import csv
import sys
from collections import Counter, defaultdict
from pathlib import Path

PREDICATES = ('looks', 'sounds', 'seems')
ACCESSES = ('both', 'visual_only', 'auditory_only', 'neither')
CELLS = [(p, a) for p in PREDICATES for a in ACCESSES]
BASE_CELL_BY_ITEM = [
    2, 7, 11, 0, 5, 9, 4, 1, 10, 6, 3, 8,
    9, 3, 5, 11, 1, 6, 0, 8, 2, 10, 7, 4,
    4, 10, 0, 6, 8, 2, 11, 5, 7, 3, 1, 9,
]


def csv_rows(path):
    with path.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def as_true(value):
    return str(value).strip().lower() in ('1', 'true', 'yes')


def write_csv(name, headings, rows):
    with open(name, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(headings)
        w.writerows(rows)


def main():
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 tools/check_counts.py results')
    files = sorted(Path(sys.argv[1]).glob('*.csv'))
    if not files:
        sys.exit('No participant CSV files found in results directory.')

    qpath = Path(__file__).resolve().parents[1] / 'data' / 'questions.csv'
    items = {q['item_id'] for q in csv_rows(qpath)}
    assert len(items) == 36
    list_stats = defaultdict(lambda: Counter(started=0, complete=0, valid_36=0))
    cell_counts = Counter()
    item_cell_counts = Counter()
    rejected = []
    for path in files:
        try:
            rows = csv_rows(path)
            item_events = [r for r in rows if r.get('phase') == 'word' and r.get('region') == 'predicate']
            if not item_events:
                rejected.append((path.name, 'no predicate events: may have stopped early'))
                continue
            lists = {r.get('list_num', '') for r in item_events}
            if len(lists) != 1:
                rejected.append((path.name, f'inconsistent list identifiers {lists}'))
                continue
            list_id = int(next(iter(lists)))
            if list_id < 0 or list_id >= 12:
                raise ValueError(f'list outside 0..11: {list_id}')
            stat = list_stats[list_id]
            stat['started'] += 1
            if not any(r.get('phase') == 'end' and as_true(r.get('completed')) for r in rows):
                continue
            stat['complete'] += 1
            ids = [r.get('item_id') for r in item_events]
            if len(ids) != 36 or set(ids) != items:
                raise ValueError(f'completed with {len(ids)} predicate trials, {len(set(ids))} unique items')
            counts = Counter((r['predicate'], r['access']) for r in item_events)
            if any(counts.get(cell, 0) != 3 for cell in CELLS):
                raise ValueError(f'list does not contain 3 items in every cell: {counts}')
            for r in item_events:
                num = int(r['item_num'])
                target_cell_num = (BASE_CELL_BY_ITEM[num - 1] + list_id) % 12
                if (r['predicate'], r['access']) != CELLS[target_cell_num]:
                    raise ValueError(f'mismatched assignment for item {num} list {list_id}')
            stat['valid_36'] += 1
            for r in item_events:
                cell = (r['predicate'], r['access'])
                item_cell_counts[(r['item_id'], cell)] += 1
                cell_counts[cell] += 1
        except Exception as exc:
            rejected.append((path.name, str(exc)))

    write_csv('list_counts.csv', ['list_num','started','complete','valid_36'],
              [[i, *[list_stats[i][k] for k in ('started','complete','valid_36')]] for i in range(12)])
    write_csv('condition_counts.csv', ['condition_num','predicate','access','n_item_trials_valid'],
              [[i,p,a,cell_counts[(p,a)]] for i,(p,a) in enumerate(CELLS)])
    write_csv('item_cell_counts.csv', ['item_id','condition_num','predicate','access','n_valid'],
              [[item,i,p,a,item_cell_counts[(item,(p,a))]] for item in sorted(items)
               for i,(p,a) in enumerate(CELLS)])
    print('List assignments (started / complete / valid):')
    for i in range(12):
        s = list_stats[i]
        print(f'  List {i:02d}: {s["started"]:>3} / {s["complete"]:>3} / {s["valid_36"]:>3}')
    vals = [item_cell_counts[(item,cell)] for item in items for cell in CELLS]
    print(f'Item x cell coverage: min={min(vals)}, max={max(vals)} across 432 combinations')
    print('Wrote list_counts.csv, condition_counts.csv, item_cell_counts.csv.')
    if rejected:
        print('\nFiles needing review:')
        for name, reason in rejected:
            print(f'  {name}: {reason}')


if __name__ == '__main__':
    main()
