import React, { useState, useEffect } from 'react';

interface Props {
  name: string;
  age?: number;
  onSubmit: () => void;
}

function TestComponent({ name, age, onSubmit }: Props) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log(count);
  }, [count]);

  const items = Array(100000)
    .fill(0)
    .map((_, i) => i);

  return (
    <div>
      <h1>{name}</h1>
      <p>Age: {age}</p>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

export default TestComponent;
