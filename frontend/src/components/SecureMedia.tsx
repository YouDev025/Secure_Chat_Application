import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, AlertCircle, Download } from 'lucide-react';

interface SecureMediaProps {
  src: string;
  token: string;
  type: 'image' | 'video' | 'audio' | 'download';
  alt?: string;
  className?: string;
  fileName?: string;
  children?: (props: {
    localUrl: string;
    downloadFn: () => Promise<void>;
    loading: boolean;
    error: string;
  }) => React.ReactNode;
}

export const SecureMedia: React.FC<SecureMediaProps> = ({
  src,
  token,
  type,
  alt = 'Media attachment',
  className = '',
  fileName = 'file',
  children,
}) => {
  const [localUrl, setLocalUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(type !== 'download');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // If the component is a download trigger, we fetch on demand, not on mount.
    if (type === 'download') return;

    let isMounted = true;
    const fetchMedia = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await axios.get(src, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        });

        if (isMounted) {
          const blobUrl = URL.createObjectURL(response.data);
          setLocalUrl(blobUrl);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Failed to load secure media:', err);
        if (isMounted) {
          setError('Failed to load secure media.');
          setLoading(false);
        }
      }
    };

    fetchMedia();

    return () => {
      isMounted = false;
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [src, token, type]);

  // Handle cleanup of localUrl if it changes
  useEffect(() => {
    return () => {
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [localUrl]);

  const handleDownload = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get(src, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });

      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup after a delay so browser completes download initiation
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 100);
      
      setLoading(false);
    } catch (err: any) {
      console.error('Download failed:', err);
      setError('Download failed.');
      setLoading(false);
      alert('Failed to download secure file.');
    }
  };

  if (children) {
    return <>{children({ localUrl, downloadFn: handleDownload, loading, error })}</>;
  }

  if (loading) {
    return (
      <div className="secure-media-loader" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', gap: '8px' }}>
        <Loader2 className="animate-spin" size={16} />
        <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Loading secure media...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="secure-media-error" style={{ display: 'flex', alignItems: 'center', padding: '8px', gap: '6px', color: '#ff4d4f' }}>
        <AlertCircle size={16} />
        <span style={{ fontSize: '0.85rem' }}>{error}</span>
      </div>
    );
  }

  if (type === 'image') {
    return <img src={localUrl} alt={alt} className={className} style={{ maxWidth: '100%', maxHeight: '350px', borderRadius: '8px', objectFit: 'contain' }} />;
  }

  if (type === 'video') {
    return <video src={localUrl} controls className={className} style={{ maxWidth: '100%', borderRadius: '8px' }} />;
  }

  if (type === 'audio') {
    return <audio src={localUrl} controls className={className} style={{ width: '100%' }} />;
  }

  // Fallback default trigger render if no children provided for download
  return (
    <button 
      type="button" 
      onClick={handleDownload} 
      className={`secure-download-btn ${className}`}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '4px', background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer' }}
    >
      <Download size={16} />
      <span>Download {fileName}</span>
    </button>
  );
};
