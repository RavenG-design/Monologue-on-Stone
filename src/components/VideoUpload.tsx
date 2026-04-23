import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Video } from 'lucide-react';

interface VideoUploadProps {
  onVideoUpload: (url: string) => void;
  currentVideo: string | null;
}

const VideoUpload: React.FC<VideoUploadProps> = ({ onVideoUpload, currentVideo }) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onVideoUpload(url);
    }
  }, [onVideoUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': [] },
    multiple: false
  } as any);

  return (
    <div className="w-full">
      {!currentVideo ? (
        <div 
          {...getRootProps()} 
          className={`
            border border-[#1A1A1A]/10 p-10 text-center cursor-pointer transition-all duration-700
            ${isDragActive ? 'bg-[#1A1A1A]/5 scale-[1.01]' : 'hover:bg-[#1A1A1A]/2'}
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4">
            <Upload className="w-4 h-4 text-[#1A1A1A]/20 stroke-[1.5px]" />
            <div className="space-y-1">
              <p className="typewriter-meta !text-[9px] !text-[#1A1A1A]/60">Integration_source</p>
              <p className="typewriter-meta !text-[7px] !text-[#1A1A1A]/30">Drag-and-drop or select file</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#1A1A1A]/2 p-5 border border-[#1A1A1A]/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-1 h-1 rounded-full bg-[#C04E35]/60 animate-pulse" />
             <span className="typewriter-meta !text-[8px] !text-[#1A1A1A]/40">Source_Locked</span>
          </div>
          <button 
            {...getRootProps()}
            className="typewriter-meta !text-[8px] !text-[#1A1A1A]/40 hover:!text-[#C04E35] transition-colors"
          >
            Replace_Source
          </button>
          <input {...getInputProps()} />
        </div>
      )}
    </div>
  );
};

export default VideoUpload;
