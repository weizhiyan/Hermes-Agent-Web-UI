import React from 'react';

export default function FilterBar({ filter, onFilterChange, totalNodes, filteredCount, categories, categoryColors }) {
  return (
    <div className="kg-filter-bar">
      {/* Category filter */}
      <button
        className={`kg-filter-chip ${!filter.category ? 'active' : ''}`}
        onClick={() => onFilterChange({ ...filter, category: '' })}
      >
        全部
      </button>
      {categories.map(cat => {
        const color = categoryColors?.[cat.key] || '#9aa3af';
        return (
          <button
            key={cat.key}
            className={`kg-filter-chip ${filter.category === cat.key ? 'active' : ''}`}
            style={filter.category === cat.key ? { background: `${color}20`, borderColor: color, color } : {}}
            onClick={() => onFilterChange({ ...filter, category: filter.category === cat.key ? '' : cat.key })}
          >
            {cat.key}
            <span className="chip-count">{cat.count}</span>
          </button>
        );
      })}

      {/* Search */}
      <div className="kg-filter-search-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          className="kg-filter-search"
          type="text"
          placeholder="搜索提示词..."
          value={filter.search}
          onChange={e => onFilterChange({ ...filter, search: e.target.value })}
        />
      </div>

      {/* Count */}
      <span className="kg-filter-count">
        {filter.search || filter.category ? `${filteredCount}/${totalNodes}` : `${totalNodes} 条提示词`}
      </span>
    </div>
  );
}
