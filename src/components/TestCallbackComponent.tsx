import React, { useState, useCallback } from 'react';

interface Item {
  id: number;
  text: string;
}

interface Props {
  onItemSelect: (item: Item) => void;
  onSort: (items: Item[]) => void;
  onFilter: (searchTerm: string) => void;
  onSubmit: (data: { id: number; value: string }) => void;
}

function TestCallbackComponent({
  onItemSelect,
  onSort,
  onFilter,
  onSubmit,
}: Props) {
  const [items, setItems] = useState<Item[]>(
    Array(100)
      .fill(0)
      .map((_, i) => ({
        id: i,
        text: `Item ${i}`,
      }))
  );
  const [searchTerm, setSearchTerm] = useState('');

  // 이것들은 전부 useCallback이 필요한 함수들입니다
  const handleItemClick = (item: Item) => {
    console.log('Item clicked:', item);
    onItemSelect(item);
  };

  const handleSort = () => {
    const sortedItems = [...items].sort((a, b) => a.text.localeCompare(b.text));
    setItems(sortedItems);
    onSort(sortedItems);
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchTerm(value);
    onFilter(value);
  };

  const handleSubmit = () => {
    const data = {
      id: Math.random(),
      value: searchTerm,
    };
    onSubmit(data);
  };

  return (
    <div>
      <input
        type='text'
        value={searchTerm}
        onChange={handleSearch}
        placeholder='Search items...'
      />
      <button onClick={handleSort}>Sort Items</button>
      <button onClick={handleSubmit}>Submit</button>

      <ul>
        {items.map((item) => (
          <li key={item.id} onClick={() => handleItemClick(item)}>
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TestCallbackComponent;
