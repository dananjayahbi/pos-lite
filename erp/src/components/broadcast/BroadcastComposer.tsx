'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Send, Mail, MessageSquare, ImagePlus, X, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  BROADCAST_TEMPLATES,
  buildEmailHtml,
  getBroadcastTemplate,
} from '@/lib/broadcast/templates';

export type ComposerChannel = 'EMAIL' | 'SMS';

interface BroadcastComposerProps {
  channel: ComposerChannel;
  onChannelChange: (channel: ComposerChannel) => void;
  subject: string;
  onSubjectChange: (subject: string) => void;
  message: string;
  onMessageChange: (message: string) => void;
  html: string;
  onHtmlChange: (html: string) => void;
  imageUrls: string[];
  onImageUrlsChange: (urls: string[]) => void;
  recipientCount: number | null;
  isSending: boolean;
  onSend: () => void;
}

const SMS_MAX_CHARS = 500;

export function BroadcastComposer({
  channel,
  onChannelChange,
  subject,
  onSubjectChange,
  message,
  onMessageChange,
  html,
  onHtmlChange,
  imageUrls,
  onImageUrlsChange,
  recipientCount,
  isSending,
  onSend,
}: BroadcastComposerProps) {
  const [templateId, setTemplateId] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEmail = channel === 'EMAIL';
  const smsOverLimit = message.length > SMS_MAX_CHARS;
  const isSendDisabled = isEmail
    ? !subject.trim() ||
      (!html.trim() && !message.trim()) ||
      recipientCount === 0 ||
      recipientCount === null ||
      isSending
    : !message.trim() ||
      smsOverLimit ||
      recipientCount === 0 ||
      recipientCount === null ||
      isSending;

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const template = getBroadcastTemplate(id);
    if (!template) return;
    onSubjectChange(template.subject);
    onHtmlChange(template.html);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = 10 - imageUrls.length;
    if (remaining <= 0) {
      toast.error('You can attach up to 10 images.');
      return;
    }

    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of Array.from(files).slice(0, remaining)) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/store/upload/broadcast-image', {
          method: 'POST',
          body: formData,
        });
        const json = await res.json();
        if (!res.ok || !json.url) {
          throw new Error(json.error ?? 'Image upload failed');
        }
        uploaded.push(json.url as string);
      }
      onImageUrlsChange([...imageUrls, ...uploaded]);
      toast.success(
        `${uploaded.length} image${uploaded.length === 1 ? '' : 's'} attached`,
      );
    } catch (error) {
      if (uploaded.length > 0) onImageUrlsChange([...imageUrls, ...uploaded]);
      toast.error(error instanceof Error ? error.message : 'Image upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (url: string) => {
    onImageUrlsChange(imageUrls.filter((candidate) => candidate !== url));
  };

  const previewHtml = buildEmailHtml({
    html,
    text: message,
    customerName: 'Nimal',
    storeName: 'Your Store',
    images: imageUrls,
  });

  return (
    <div className="space-y-4">
      {/* Channel selector */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={isEmail ? 'default' : 'outline'}
          className={
            isEmail
              ? 'bg-espresso text-pearl hover:bg-espresso/90'
              : 'border-mist text-espresso'
          }
          onClick={() => onChannelChange('EMAIL')}
        >
          <Mail className="mr-2 h-4 w-4" />
          Email
        </Button>
        <Button
          type="button"
          variant={!isEmail ? 'default' : 'outline'}
          className={
            !isEmail
              ? 'bg-espresso text-pearl hover:bg-espresso/90'
              : 'border-mist text-espresso'
          }
          onClick={() => onChannelChange('SMS')}
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          SMS
        </Button>
      </div>

      <div className="rounded-lg border border-mist bg-linen/50 p-3 text-xs text-espresso">
        Use <code className="rounded bg-pearl px-1 font-mono">{'{{name}}'}</code> for the
        customer&apos;s first name and{' '}
        <code className="rounded bg-pearl px-1 font-mono">{'{{storeName}}'}</code> for your
        store name. They are replaced per recipient at send time.
      </div>

      {isEmail ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="broadcast-subject" className="text-sm font-semibold text-espresso">
              Subject
            </Label>
            <Input
              id="broadcast-subject"
              value={subject}
              onChange={(event) => onSubjectChange(event.target.value)}
              maxLength={200}
              placeholder="A special offer from {{storeName}}"
              className="border-mist"
            />
            <p className="text-[11px] text-sand-ink">{subject.length}/200</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-espresso">Email template</Label>
            <Select value={templateId} onValueChange={applyTemplate}>
              <SelectTrigger className="border-mist">
                <SelectValue placeholder="Choose a template" />
              </SelectTrigger>
              <SelectContent>
                {BROADCAST_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} — {template.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="broadcast-html" className="text-sm font-semibold text-espresso">
                HTML body
              </Label>
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="text-sand-ink hover:text-espresso">
                    <Eye className="mr-1 h-4 w-4" />
                    Preview
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="font-display text-espresso">Email preview</DialogTitle>
                  </DialogHeader>
                  <iframe
                    title="Email preview"
                    srcDoc={previewHtml}
                    sandbox=""
                    className="h-[420px] w-full rounded-lg border border-mist bg-white"
                  />
                </DialogContent>
              </Dialog>
            </div>
            <Textarea
              id="broadcast-html"
              value={html}
              onChange={(event) => onHtmlChange(event.target.value)}
              rows={10}
              className="resize-y border-mist font-mono text-xs"
              placeholder="<p>Hi {{name}}, ...</p>"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="broadcast-plaintext" className="text-sm font-semibold text-espresso">
              Plain-text fallback{' '}
              <span className="text-xs font-normal text-sand-ink">(optional)</span>
            </Label>
            <Textarea
              id="broadcast-plaintext"
              value={message}
              onChange={(event) => onMessageChange(event.target.value)}
              rows={3}
              className="resize-none border-mist font-mono text-xs"
              placeholder="Hi {{name}}, ..."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-espresso">
                Images{' '}
                <span className="text-xs font-normal text-sand-ink">({imageUrls.length}/10)</span>
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={(event) => void handleFiles(event.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-mist text-espresso"
                disabled={uploading || imageUrls.length >= 10}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
                )}
                {uploading ? 'Uploading…' : 'Attach images'}
              </Button>
            </div>

            {imageUrls.length === 0 ? (
              <p className="text-[11px] text-sand-ink">
                Uploaded images are embedded in the email and also attached as files.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {imageUrls.map((url) => (
                  <div key={url} className="relative overflow-hidden rounded-md border border-mist">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="Broadcast attachment" className="h-24 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      className="absolute right-1 top-1 rounded-full bg-espresso/80 p-1 text-pearl hover:bg-espresso"
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="broadcast-sms" className="text-sm font-semibold text-espresso">
              SMS message
            </Label>
            <Badge variant="secondary" className="text-xs">
              {message.length}/{SMS_MAX_CHARS}
            </Badge>
          </div>
          <Textarea
            id="broadcast-sms"
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            rows={6}
            maxLength={SMS_MAX_CHARS + 50}
            className={`resize-none border-mist font-mono text-sm ${
              smsOverLimit ? 'border-red-400' : ''
            }`}
            placeholder="Hi {{name}}! Visit {{storeName}} this week for a special offer."
          />
          <p className={`text-xs ${smsOverLimit ? 'text-red-600' : 'text-sand-ink'}`}>
            {smsOverLimit
              ? `Message is ${message.length - SMS_MAX_CHARS} characters over the ${SMS_MAX_CHARS} limit.`
              : `${SMS_MAX_CHARS - message.length} characters remaining. Long messages are sent as multiple SMS segments.`}
          </p>
        </div>
      )}

      <Button
        onClick={onSend}
        disabled={isSendDisabled}
        className="w-full bg-terracotta font-semibold text-pearl hover:bg-terracotta/90"
      >
        {isSending ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-pearl border-t-transparent" />
            Sending…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Send {isEmail ? 'Email' : 'SMS'} Broadcast
          </span>
        )}
      </Button>
    </div>
  );
}
