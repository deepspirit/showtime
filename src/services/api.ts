// 开发环境直接使用后端 HTTP API，避免 HTTPS 页面请求 HTTP API 的跨域问题
const API_BASE = 'http://localhost:3001/api';

export interface StitchResponse {
  success: boolean;
  filename?: string;
  path?: string;
  stats?: {
    totalImages: number;
    outputWidth: number;
    outputHeight: number;
    format: string;
  };
  error?: string;
  details?: string;
}

export const imageApi = {
  async stitchImages(files: File[]): Promise<StitchResponse> {
    const formData = new FormData();
    
    files.forEach((file) => {
      formData.append('images', file);
    });

    try {
      const response = await fetch(`${API_BASE}/stitch`, {
        method: 'POST',
        body: formData,
        mode: 'cors',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to stitch images`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('网络连接失败，请检查服务器是否正常运行');
      }
      throw error;
    }
  },

  getDownloadUrl(filename: string): string {
    return `${API_BASE}/download/${filename}`;
  },

  async cleanup(): Promise<void> {
    await fetch(`${API_BASE}/cleanup`, { method: 'POST', mode: 'cors' });
  }
};
