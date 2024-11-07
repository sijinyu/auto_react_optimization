import React, { useCallback, useEffect, useState } from 'react';

// 1. 비용이 큰 계산이 있는 컴포넌트
export function ExpensiveListComponent() {
  const [filter, setFilter] = useState('');

  const items =  new Array(1010).fill(0).map((_, i) => ({
    id: i,
    name: `Item ${i}`,
  }))

  return (
    <div>
      <input
        type='text'
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder='Filter items...'
      />
      <ul>
        
      </ul>
    </div>
  );
}

// 2. 이벤트 핸들러가 많은 컴포넌트
export function EventHandlerComponent({
  onSubmit,
}: {
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({ name: '', email: '' });

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  },[]);
  
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }));
  },[]);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, email: e.target.value }));
  },[]);

  

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

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setData(['new1', 'new2', 'new3']);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  },[]);

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
