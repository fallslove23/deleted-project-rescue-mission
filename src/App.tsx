import React from 'react';

function App() {
  console.log('App 컴포넌트가 렌더링됩니다');
  
  return (
    <div style={{ padding: '20px' }}>
      <h1>디버깅 테스트</h1>
      <p>현재 시간: {new Date().toLocaleString()}</p>
      <p>이 화면이 보인다면 기본 구조는 작동합니다.</p>
      <p>다음 단계: useAuth 추가</p>
    </div>
  );
}

export default App;