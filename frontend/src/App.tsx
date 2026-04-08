import { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [url, setUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [embedId, setEmbedId] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('Hindi');
  const [targetLanguage, setTargetLanguage] = useState('English');
  const [jobId, setJobId] = useState('');
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState<{ [key: string]: number }>({
    download: 0,
    extraction: 0,
    transcription: 0,
    translation: 0,
    tts: 0
  });
  const [outputUrl, setOutputUrl] = useState('');
  const [error, setError] = useState('');

  // Load states from localStorage on mount
  useEffect(() => {
    const savedJobId = localStorage.getItem('currentJobId');
    const savedUrl = localStorage.getItem('currentUrl');
    const savedSourceLang = localStorage.getItem('currentSourceLang');
    const savedTargetLang = localStorage.getItem('currentTargetLang');
    const savedEmbedId = localStorage.getItem('currentEmbedId');
    const savedShowPreview = localStorage.getItem('currentShowPreview') === 'true';

    if (savedUrl) setUrl(savedUrl);
    if (savedSourceLang) setSourceLanguage(savedSourceLang);
    if (savedTargetLang) setTargetLanguage(savedTargetLang);
    if (savedJobId) setJobId(savedJobId);
    if (savedEmbedId) setEmbedId(savedEmbedId);
    if (savedShowPreview) setShowPreview(savedShowPreview);
  }, []);

  // Save states to localStorage when they change
  useEffect(() => {
    localStorage.setItem('currentUrl', url);
    localStorage.setItem('currentSourceLang', sourceLanguage);
    localStorage.setItem('currentTargetLang', targetLanguage);
    localStorage.setItem('currentEmbedId', embedId);
    localStorage.setItem('currentShowPreview', showPreview.toString());

    if (jobId) {
      localStorage.setItem('currentJobId', jobId);
    } else {
      localStorage.removeItem('currentJobId');
    }
  }, [jobId, url, sourceLanguage, targetLanguage, embedId, showPreview]);

  const sourceLanguages = ['Hindi', 'English'];
  const targetLanguages = ['Hindi', 'English'];

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleClearUrl = () => {
    setUrl('');
    setShowPreview(false);
    setEmbedId('');
    localStorage.removeItem('currentUrl');
  };

  const handleCopyUrl = () => {
    if (url) {
      navigator.clipboard.writeText(url);
    }
  };

  const handleLoadPreview = () => {
    const id = getYoutubeId(url);
    if (id) {
      setEmbedId(id);
      setShowPreview(true);
      setError('');
    } else {
      setError('Invalid YouTube URL');
      setShowPreview(false);
    }
  };

  const handleCancel = async () => {
    if (!jobId) return;
    try {
      await axios.post(`/api/cancel/${jobId}`);
      setJobId('');
      setStatus('');
      setMessage('');
      setOutputUrl('');
      localStorage.removeItem('currentJobId');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const handleNewConversion = () => {
    setJobId('');
    setStatus('');
    setMessage('');
    setProgress({ download: 0, extraction: 0, transcription: 0, translation: 0, tts: 0 });
    setOutputUrl('');
    setError('');
    setUrl('');
    setShowPreview(false);
    setEmbedId('');
    localStorage.clear(); // Clear all saved states for a fresh start
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    setJobId('');
    setStatus('');
    setMessage('');
    setProgress({ download: 0, extraction: 0, transcription: 0, translation: 0, tts: 0 });
    setOutputUrl('');
    setError('');

    try {
      const response = await axios.post('/api/convert', {
        youtube_url: url,
        source_language: sourceLanguage,
        target_language: targetLanguage,
      });
      setJobId(response.data.job_id);
      setStatus(response.data.status);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (jobId && status !== 'Complete' && status !== 'Failed') {
      interval = setInterval(async () => {
        try {
          const response = await axios.get(`/api/status/${jobId}`);
          setStatus(response.data.status);
          setMessage(response.data.message);
          if (response.data.progress) {
            setProgress(prev => ({ ...prev, ...response.data.progress }));
          }
          if (response.data.output_url) {
            setOutputUrl(response.data.output_url);
          }
          if (response.data.error) {
            setError(response.data.error);
          }
        } catch (err) {
          console.error("Error fetching status", err);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [jobId, status]);

  const ProgressBar = ({ label, value, color = "bg-indigo-500" }: { label: string, value: number, color?: string }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-medium text-indigo-200">
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-1.5">
        <div 
          className={`${color} h-1.5 rounded-full transition-all duration-300 ease-out`} 
          style={{ width: `${value}%` }}
        ></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-gray-800 rounded-lg shadow-2xl p-6 sm:p-10 border border-gray-700">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
              Multilingual Video Converter
            </h1>
            <p className="mt-4 text-lg text-gray-400">
              Convert Hindi or English YouTube videos to dubbed versions instantly.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-300">
                YouTube URL
              </label>
              <div className="mt-1 flex space-x-2">
                <div className="relative flex-grow">
                  <input
                    type="url"
                    name="url"
                    id="url"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setShowPreview(false);
                    }}
                    required
                    className="bg-gray-700 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-600 rounded-md p-3 pr-20 border text-white placeholder-gray-500"
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  {url && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
                      <button
                        type="button"
                        onClick={handleCopyUrl}
                        title="Copy URL"
                        className="p-1 text-gray-400 hover:text-indigo-400 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={handleClearUrl}
                        title="Clear Field"
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleLoadPreview}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  Load Video
                </button>
              </div>
              {(url || jobId) && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={handleNewConversion}
                    className="px-8 py-3 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-full text-sm font-bold text-gray-200 transition-all shadow-lg flex items-center space-x-3 group uppercase tracking-widest"
                  >
                    <svg 
                      className="w-5 h-5 text-gray-400 group-hover:rotate-180 transition-transform duration-500" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Start New Conversion</span>
                  </button>
                </div>
              )}
            </div>

            {showPreview && embedId && (
              <div className="space-y-8 animate-fade-in">
                <div className="aspect-w-16 aspect-h-9 w-full rounded-lg overflow-hidden bg-black ring-1 ring-gray-700">
                  <iframe
                    className="w-full h-[400px]"
                    src={`https://www.youtube.com/embed/${embedId}`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>

                <form onSubmit={handleSubmit} className="bg-gray-700/30 p-6 rounded-lg border border-gray-600 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="sourceLanguage" className="block text-sm font-medium text-gray-300">
                        Original Language
                      </label>
                      <div className="mt-1">
                        <select
                          id="sourceLanguage"
                          name="sourceLanguage"
                          value={sourceLanguage}
                          onChange={(e) => setSourceLanguage(e.target.value)}
                          className="bg-gray-700 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-600 rounded-md p-3 border text-white"
                        >
                          {sourceLanguages.map((lang) => (
                            <option key={lang} value={lang}>
                              {lang}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="targetLanguage" className="block text-sm font-medium text-gray-300">
                        Target Language
                      </label>
                      <div className="mt-1">
                        <select
                          id="targetLanguage"
                          name="targetLanguage"
                          value={targetLanguage}
                          onChange={(e) => setTargetLanguage(e.target.value)}
                          className="bg-gray-700 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-600 rounded-md p-3 border text-white"
                        >
                          {targetLanguages.map((lang) => (
                            <option key={lang} value={lang}>
                              {lang}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-3">
                    <button
                      type="submit"
                      disabled={status !== '' && status !== 'Failed'}
                      className="w-full flex justify-center py-4 px-4 border border-transparent rounded-md shadow-sm text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 transition-all uppercase tracking-widest"
                    >
                      {status === 'Complete' ? 'Dubbing Complete' : (status !== '' && status !== 'Failed' ? 'Processing...' : 'Start Dubbing Process')}
                    </button>
                    
                    {status !== '' && status !== 'Complete' && status !== 'Failed' && (
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="w-full flex justify-center py-2 px-4 border border-red-500/50 rounded-md shadow-sm text-sm font-bold text-red-400 hover:bg-red-500/10 focus:outline-none transition-all uppercase tracking-wider"
                      >
                        Cancel Dubbing
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}
          </div>

          {status && (
            <div className="mt-8 space-y-4">
              <div className="rounded-md bg-indigo-900/30 border border-indigo-500/30 p-4">
                <div className="flex flex-col space-y-4">
                  <div className="flex justify-between items-center border-b border-indigo-500/20 pb-2">
                    <p className="text-sm text-indigo-100 font-bold uppercase tracking-wider">
                      Process Status: {status}
                    </p>
                    <div className={`w-2 h-2 rounded-full animate-pulse ${status === 'Complete' ? 'bg-green-500' : status === 'Failed' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                  </div>
                  
                  <p className="text-sm text-indigo-300 italic">{message}</p>
                  
                  <div className="grid grid-cols-1 gap-4 mt-2">
                    <ProgressBar label="Video Download" value={progress.download} />
                    <ProgressBar label="Audio Extraction" value={progress.extraction} color="bg-blue-500" />
                    <ProgressBar label="Transcription" value={progress.transcription} color="bg-purple-500" />
                    <ProgressBar label="Translation (AI)" value={progress.translation} color="bg-pink-500" />
                    <ProgressBar label="Voice Synthesis (TTS)" value={progress.tts} color="bg-emerald-500" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 space-y-4">
              <div className="rounded-md bg-red-900/30 border border-red-500/30 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-300">Error</h3>
                    <div className="mt-2 text-sm text-red-400 font-mono">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {outputUrl && status === 'Complete' && (
            <div className="mt-10">
              <h2 className="text-xl font-bold text-white mb-4">Result</h2>
              <div className="aspect-w-16 aspect-h-9 w-full overflow-hidden rounded-lg bg-black ring-1 ring-gray-700">
                <video controls className="w-full h-full object-cover" src={outputUrl}>
                  Your browser does not support the video tag.
                </video>
              </div>
              <div className="mt-6 text-center">
                <a
                  href={outputUrl}
                  download="dubbed_video.mp4"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                >
                  Download Video
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;