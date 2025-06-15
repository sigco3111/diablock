
import React from 'react';

const ImageGenerator: React.FC = () => {
  return (
    <div className="p-4 space-y-4 text-center">
      <h3 className="text-lg font-semibold text-gray-300">AI 이미지 생성기</h3>
      <p className="text-gray-400">
        AI 이미지 생성 기능이 제거되었습니다.
      </p>
      <p className="text-xs text-gray-500 mt-2">
        이 기능은 이전에 Google Gemini API를 사용했습니다.
      </p>
    </div>
  );
};

export default ImageGenerator;