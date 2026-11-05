import React, { useState } from 'react';
import { 
  MessageSquare, 
  CheckCircle2, 
  Circle, 
  Send, 
  Reply, 
  Copy, 
  Check, 
  Clock, 
  Filter, 
  Sparkles,
  Volume2,
  Type,
  Scissors,
  Palette,
  Tag
} from 'lucide-react';
import { ProjectComment, CommentCategory } from '../types';
import { playClickPop } from '../utils/audio';

interface TimestampCommentsProps {
  comments: ProjectComment[];
  currentTime: number;
  activeCommentId?: string | null;
  onSeekTo: (seconds: number) => void;
  onAddComment: (comment: Omit<ProjectComment, 'id' | 'createdAt' | 'resolved' | 'replies'>) => void;
  onToggleResolve: (commentId: string) => void;
  onAddReply: (commentId: string, replyText: string, authorName: string) => void;
  isEditorView?: boolean;
}

export const TimestampComments: React.FC<TimestampCommentsProps> = ({
  comments,
  currentTime,
  activeCommentId,
  onSeekTo,
  onAddComment,
  onToggleResolve,
  onAddReply,
  isEditorView = false
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [commentText, setCommentText] = useState('');
  const [category, setCategory] = useState<CommentCategory>('cut');
  const [authorName, setAuthorName] = useState(isEditorView ? 'Editor' : 'Client');
  const [targetTime, setTargetTime] = useState<number>(currentTime);
  const [copied, setCopied] = useState(false);

  // Active reply input
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Keep targetTime synchronized if user hasn't edited text yet or on initial load
  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleUseCurrentTime = () => {
    setTargetTime(currentTime);
    playClickPop();
  };

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    onAddComment({
      projectId: '',
      author: isEditorView ? 'editor' : 'client',
      authorName: authorName.trim() || (isEditorView ? 'Editor' : 'Client'),
      timestampSeconds: targetTime,
      formattedTime: formatTime(targetTime),
      text: commentText.trim(),
      category: category
    });

    setCommentText('');
    playClickPop();
  };

  const handleSendReply = (commentId: string) => {
    if (!replyText.trim()) return;
    onAddReply(commentId, replyText.trim(), isEditorView ? 'Editor (Vikram)' : authorName);
    setReplyText('');
    setReplyingToId(null);
    playClickPop();
  };

  // Copy structured WhatsApp bullet points
  const handleCopyWhatsAppRevisions = () => {
    const pendingList = comments.filter(c => !c.resolved);
    if (pendingList.length === 0) {
      navigator.clipboard.writeText('✅ All revisions have been completed and verified on Zikro!');
    } else {
      let msg = `🎬 *Zikro Video Revisions List*:\n\n`;
      pendingList.forEach((c, idx) => {
        msg += `${idx + 1}. [${c.formattedTime}] *${c.category.toUpperCase()}*: ${c.text}\n`;
      });
      msg += `\n🔗 Review live at Zikro preview link.`;
      navigator.clipboard.writeText(msg);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Categories config
  const categoryConfig: Record<CommentCategory, { label: string; icon: React.ReactNode; color: string }> = {
    cut: { label: 'Cut / Pacing', icon: <Scissors className="w-3 h-3" />, color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
    text: { label: 'Subtitle / Font', icon: <Type className="w-3 h-3" />, color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    audio: { label: 'Audio / SFX', icon: <Volume2 className="w-3 h-3" />, color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
    color: { label: 'Color / Grade', icon: <Palette className="w-3 h-3" />, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    general: { label: 'General Note', icon: <Tag className="w-3 h-3" />, color: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/30' }
  };

  // Filtered comments
  const sortedComments = [...comments].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
  const filteredComments = sortedComments.filter(c => {
    if (filter === 'pending') return !c.resolved;
    if (filter === 'resolved') return c.resolved;
    return true;
  });

  const pendingCount = comments.filter(c => !c.resolved).length;

  return (
    <div className="w-full bg-neutral-900/90 border border-neutral-800 rounded-2xl flex flex-col overflow-hidden shadow-xl">
      {/* Header Bar */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-sm text-neutral-100">
            Timeline Feedback
          </h3>
          <span className="text-xs bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full font-mono">
            {comments.length}
          </span>
          {pendingCount > 0 && (
            <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-medium">
              {pendingCount} Pending
            </span>
          )}
        </div>

        {/* WhatsApp Export & Filter Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyWhatsAppRevisions}
            title="Copy all pending revision points formatted for WhatsApp"
            className="inline-flex items-center gap-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-2.5 py-1.5 rounded-lg border border-neutral-700 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy for WhatsApp'}</span>
          </button>

          <div className="flex items-center bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-1 rounded-md transition ${filter === 'all' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:text-white'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-2 py-1 rounded-md transition ${filter === 'pending' ? 'bg-neutral-800 text-amber-300 font-medium' : 'text-neutral-400 hover:text-white'}`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter('resolved')}
              className={`px-2 py-1 rounded-md transition ${filter === 'resolved' ? 'bg-neutral-800 text-emerald-400 font-medium' : 'text-neutral-400 hover:text-white'}`}
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Add New Timestamp Comment Form */}
      <form onSubmit={handleSubmitComment} className="p-3.5 bg-neutral-950/60 border-b border-neutral-800/80">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          {/* Timestamp picker pill */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleUseCurrentTime}
              title="Click to snap comment to current video timecode"
              className="inline-flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Timestamp: {formatTime(targetTime)}</span>
              <span className="text-[10px] text-amber-400/80 font-sans ml-1 underline">Snap to current</span>
            </button>
          </div>

          {/* Name input */}
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Your Name (Client / Editor)"
            className="bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs rounded-md px-2.5 py-1 w-36 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Category selector pills */}
        <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto pb-1 text-xs">
          {(Object.keys(categoryConfig) as CommentCategory[]).map(catKey => {
            const item = categoryConfig[catKey];
            const isSelected = category === catKey;
            return (
              <button
                key={catKey}
                type="button"
                onClick={() => setCategory(catKey)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] whitespace-nowrap transition ${
                  isSelected 
                    ? `${item.color} font-medium ring-1 ring-white/20` 
                    : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Input box */}
        <div className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={`e.g. "Bhai ${formatTime(targetTime)} par subtitle font change karo..."`}
            className="flex-1 bg-neutral-900 border border-neutral-700/80 focus:border-amber-500 text-neutral-100 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none placeholder:text-neutral-500"
          />
          <button
            type="submit"
            disabled={!commentText.trim()}
            className="inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-neutral-950 font-bold px-3.5 py-2.5 rounded-xl text-xs transition shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>

        {/* Quick suggestions for freelance video feedback */}
        <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5 text-[11px] text-neutral-400">
          <span className="text-[10px] uppercase font-mono text-neutral-500 shrink-0">Quick:</span>
          {[
            'Beat drop pe SFX loud karo',
            'Subtitle yellow bold karo',
            'Cut thoda fast karo',
            'Logo 2 sec pehle add karo'
          ].map((quick, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setCommentText(quick);
                handleUseCurrentTime();
              }}
              className="shrink-0 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-amber-300 px-2 py-0.5 rounded border border-neutral-800 transition text-[10px]"
            >
              + {quick}
            </button>
          ))}
        </div>
      </form>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto max-h-[380px] p-3 space-y-2.5 divide-y divide-neutral-800/40">
        {filteredComments.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 text-xs">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30 text-neutral-400" />
            <p>No feedback matching this filter.</p>
            <p className="text-[11px] text-neutral-600 mt-1">Tap anywhere on the video timeline to add revision notes!</p>
          </div>
        ) : (
          filteredComments.map((comment) => {
            const isActive = activeCommentId === comment.id;
            const cat = categoryConfig[comment.category] || categoryConfig.general;

            return (
              <div 
                key={comment.id}
                className={`pt-2.5 first:pt-0 transition rounded-xl p-2.5 ${
                  isActive 
                    ? 'bg-amber-500/10 border border-amber-500/30' 
                    : comment.resolved 
                      ? 'opacity-65 hover:opacity-100 bg-neutral-900/30' 
                      : 'hover:bg-neutral-800/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    {/* Resolve Checkbox */}
                    <button
                      onClick={() => onToggleResolve(comment.id)}
                      title={comment.resolved ? 'Mark as Unresolved' : 'Mark as Resolved / Fixed'}
                      className="mt-0.5 text-neutral-500 hover:text-emerald-400 transition shrink-0"
                    >
                      {comment.resolved ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-neutral-600 hover:text-amber-400" />
                      )}
                    </button>

                    <div>
                      {/* Jump-to-timestamp chip & category */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <button
                          onClick={() => onSeekTo(comment.timestampSeconds)}
                          title="Click to jump video to this exact moment"
                          className="inline-flex items-center gap-1 bg-neutral-800 hover:bg-amber-500/20 hover:text-amber-300 text-neutral-200 px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition"
                        >
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>{comment.formattedTime}</span>
                        </button>

                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${cat.color}`}>
                          {cat.icon}
                          <span>{cat.label}</span>
                        </span>

                        <span className="text-[11px] text-neutral-400 font-medium">
                          {comment.authorName}
                        </span>
                      </div>

                      {/* Comment text */}
                      <p className={`text-xs text-neutral-200 leading-relaxed ${comment.resolved ? 'line-through text-neutral-400' : ''}`}>
                        {comment.text}
                      </p>
                    </div>
                  </div>

                  {/* Reply trigger button */}
                  <button
                    onClick={() => {
                      setReplyingToId(replyingToId === comment.id ? null : comment.id);
                      setReplyText('');
                    }}
                    title="Reply to this feedback"
                    className="text-neutral-500 hover:text-amber-400 text-xs p-1 rounded transition shrink-0"
                  >
                    <Reply className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Replies Thread */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="ml-7 mt-2 pl-2 border-l border-neutral-700 space-y-1.5">
                    {comment.replies.map(r => (
                      <div key={r.id} className="bg-neutral-950/60 p-2 rounded-lg text-xs">
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-medium mb-0.5">
                          <span>{r.authorName}</span>
                          <span className="text-neutral-600">•</span>
                          <span className="text-neutral-500">{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-neutral-300 text-[11px]">{r.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Input Form */}
                {replyingToId === comment.id && (
                  <div className="ml-7 mt-2 flex gap-1.5">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Reply (e.g. 'Done, updated in v2')..."
                      autoFocus
                      className="flex-1 bg-neutral-950 border border-neutral-700 text-neutral-100 text-[11px] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleSendReply(comment.id)}
                      className="bg-amber-500 text-neutral-950 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                    >
                      Reply
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
