export default function FilterBar({ tags, activeTag, onSelect }) {
  if (!tags.length) return null

  return (
    <div className="filter-bar">
      <button
        className={`filter-btn ${!activeTag ? 'active' : ''}`}
        onClick={() => onSelect(null)}
      >
        All
      </button>
      {tags.map(tag => (
        <button
          key={tag}
          className={`filter-btn ${activeTag === tag ? 'active' : ''}`}
          onClick={() => onSelect(tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  )
}
