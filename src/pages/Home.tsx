import { useCallback, useState } from 'react';
import { useImageStore, ImageFile } from '@/store/imageStore';
import { imageApi } from '@/services/api';
import { Trash2, Upload, Image as ImageIcon, Download, Loader2, AlertCircle } from 'lucide-react';

export default function Home() {
  const {
    images,
    isProcessing,
    error,
    result,
    addImages,
    removeImage,
    reorderImages,
    clearImages,
    setProcessing,
    setError,
    setResult,
  } = useImageStore();

  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (files) {
        addImages(Array.from(files));
      }
    },
    [addImages]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleStitch = async () => {
    if (images.length < 2) {
      setError('Please add at least 2 images');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await imageApi.stitchImages(images.map((img) => img.file));
      
      if (response.success) {
        setResult({
          filename: response.filename!,
          path: response.path!,
          stats: response.stats,
        });
      } else {
        setError(response.error || 'Failed to stitch images');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = () => {
    if (result) {
      window.location.href = result.path;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleImageDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleImageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleImageDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (dragIndex !== dropIndex) {
      reorderImages(dragIndex, dropIndex);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <ImageIcon className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Image Stitcher
              </h1>
              <p className="text-sm text-gray-400">Lossless long image拼接工具</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
            isDragOver
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-white/20 hover:border-purple-500/50 hover:bg-white/5'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload className="w-16 h-16 mx-auto mb-4 text-purple-400" />
          <p className="text-xl font-semibold mb-2">拖拽图片到这里</p>
          <p className="text-gray-400 mb-4">或者点击下方按钮选择文件</p>
          <label className="inline-block">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
            <span className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg cursor-pointer transition-colors">
              <Upload className="w-5 h-5" />
              选择图片
            </span>
          </label>
          <p className="mt-4 text-sm text-gray-500">
            支持 JPG, PNG, WebP, GIF • 最多 30 张图片 • 无损输出 PNG
          </p>
        </div>

        {/* Image Grid */}
        {images.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                已添加 {images.length} 张图片
                {images.length < 2 && (
                  <span className="ml-2 text-sm text-yellow-400">
                    (至少需要 2 张)
                  </span>
                )}
              </h2>
              <button
                onClick={clearImages}
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                清除全部
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {images.map((image, index) => (
                <ImageCard
                  key={image.id}
                  image={image}
                  index={index}
                  onRemove={() => removeImage(image.id)}
                  onDragStart={handleImageDragStart}
                  onDragOver={handleImageDragOver}
                  onDrop={handleImageDrop}
                  formatFileSize={formatFileSize}
                />
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-semibold">出错了</p>
              <p className="text-red-300/80 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Result Display */}
        {result && (
          <div className="mt-6 p-6 bg-green-500/10 border border-green-500/30 rounded-lg">
            <h3 className="text-lg font-semibold text-green-400 mb-3">
              拼接成功！
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-black/20 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">输出信息</p>
                <div className="space-y-1 text-sm">
                  <p>图片数量: {result.stats?.totalImages}</p>
                  <p>
                    输出尺寸: {result.stats?.outputWidth} x{' '}
                    {result.stats?.outputHeight} px
                  </p>
                  <p>格式: {result.stats?.format}</p>
                </div>
              </div>
              <div className="flex items-center">
                <button
                  onClick={handleDownload}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  <Download className="w-5 h-5" />
                  下载拼接结果
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        {images.length >= 2 && (
          <div className="mt-8 text-center">
            <button
              onClick={handleStitch}
              disabled={isProcessing || images.length < 2}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 disabled:hover:scale-100"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <ImageIcon className="w-6 h-6" />
                  开始拼接
                </>
              )}
            </button>
            {isProcessing && (
              <p className="mt-3 text-sm text-gray-400">
                正在处理 {images.length} 张图片，请稍候...
              </p>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-12 py-6 text-center text-gray-500 text-sm">
        <p>无损拼接 • 支持 30+ 张图片 • 输出 PNG 格式</p>
      </footer>
    </div>
  );
}

interface ImageCardProps {
  image: ImageFile;
  index: number;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  formatFileSize: (bytes: number) => string;
}

function ImageCard({
  image,
  index,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  formatFileSize,
}: ImageCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, index)}
      className="group relative bg-white/5 rounded-lg overflow-hidden border border-white/10 hover:border-purple-500/50 transition-all cursor-move"
    >
      {/* Index Badge */}
      <div className="absolute top-2 left-2 z-10 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-xs font-bold">
        {index + 1}
      </div>

      {/* Remove Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-2 right-2 z-10 p-1 bg-red-600 hover:bg-red-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Image Preview */}
      <div className="aspect-square bg-black/20">
        <img
          src={image.preview}
          alt={image.name}
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>

      {/* Image Info */}
      <div className="p-2">
        <p className="text-xs text-gray-400 truncate" title={image.name}>
          {image.name}
        </p>
        <p className="text-xs text-gray-500">{formatFileSize(image.size)}</p>
      </div>
    </div>
  );
}
