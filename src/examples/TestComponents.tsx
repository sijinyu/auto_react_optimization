import React, { useEffect, useState } from 'react';

// 1. 비용이 큰 계산이 있는 컴포넌트
export function ExpensiveListComponent() {
  const [filter, setFilter] = useState('');

  const items = new Array(1000).fill(0).map((_, i) => ({
    id: i,
    name: `Item ${i}`,
  }));

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <input
        type='text'
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder='Filter items...'
      />
      <ul>
        {filteredItems.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}

export function NomalComponent() {
  const [count, useCount] = useState(0);

  const heavyArray = Array(100000).fill(0);
  const 증가 = () => useCount((prev) => prev + 1);
  const 감소 = () => useCount((prev) => prev - 1);
  const 몰라 = () => useCount((prev) => prev - 1);
  const 히히 = () => useCount((prev) => prev - 1);

  return (
    <div>
      <div>
        {heavyArray.map(() => (
          <p>s</p>
        ))}
      </div>
      <div>{count}</div>
      <ChildComponent
        handleClick={증가}
        handleC={감소}
        handleD={감소}
        handleE={감소}
        handleA={몰라}
        handleB={히히}
      />
    </div>
  );
}
function ChildComponent({
  handleClick,
  handleC,
  handleA,
  handleB,
}: {
  handleClick: () => void;
  handleC: () => void;
  handleA: () => void;
  handleB: () => void;
  handleD: () => void;
  handleE: () => void;
}) {
  console.log(handleC, handleA, handleB);
  return <button onClick={handleClick}>증가</button>;
}
// 2. 이벤트 핸들러가 많은 컴포넌트
export function EventHandlerComponent({
  onSubmit,
}: {
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({ name: '', email: '' });

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }));
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, email: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type='text'
        value={formData.name}
        onChange={handleNameChange}
        placeholder='Name'
      />
      <input
        type='email'
        value={formData.email}
        onChange={handleEmailChange}
        placeholder='Email'
      />
      <button type='submit'>Submit</button>
    </form>
  );
}

// 3. 복잡한 Hook 사용 패턴을 가진 컴포넌트
export function ComplexHookComponent() {
  const [data, setData] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 가상의 API 호출
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setData(['item1', 'item2', 'item3']);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setData(['new1', 'new2', 'new3']);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <button onClick={handleRefresh}>Refresh</button>
      <ul>
        {data.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
