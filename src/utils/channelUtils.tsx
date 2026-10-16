import React from 'react';
import { 
  ShoppingBag, 
  Share2, 
  Globe, 
  MessageCircle, 
  MessageSquare, 
  PhoneCall, 
  Video, 
  Search, 
  Store, 
  Smartphone, 
  UserCheck, 
  Radio, 
  MousePointer, 
  Sparkles,
  FileSpreadsheet,
  Zap,
  Tag
} from 'lucide-react';
import { Order, SalesChannel } from '../types';

export interface ChannelInfo {
  id: string;
  name: string;
  shortName: string;
  icon: React.ReactNode;
  logoUrl?: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotColor: string;
}

export const CHANNEL_PRESETS: ChannelInfo[] = [
  {
    id: 'web_store',
    name: 'المتجر الإلكتروني',
    shortName: 'المتجر',
    icon: <Store className="w-3.5 h-3.5" />,
    bgClass: 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50',
    textClass: 'text-indigo-700 dark:text-indigo-300 font-bold',
    borderClass: 'border-indigo-200 dark:border-indigo-800',
    dotColor: 'bg-indigo-500'
  },
  {
    id: 'direct_manual',
    name: 'طلب يدوي / مباشر',
    shortName: 'يدوي',
    icon: <UserCheck className="w-3.5 h-3.5" />,
    bgClass: 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700',
    textClass: 'text-slate-700 dark:text-slate-300 font-bold',
    borderClass: 'border-slate-300 dark:border-slate-700',
    dotColor: 'bg-slate-400'
  }
];

export function getOrderChannelName(order: Partial<Order>, configuredSalesChannels?: SalesChannel[]): string {
  if (order.sourceChannel && order.sourceChannel.trim()) {
    const raw = order.sourceChannel.trim();
    if (configuredSalesChannels && configuredSalesChannels.length > 0) {
      const matched = configuredSalesChannels.find(sc => 
        sc.name.toLowerCase().trim() === raw.toLowerCase() ||
        sc.id === raw
      );
      if (matched) return matched.name;
    }
    return raw;
  }

  // Check if channel ID is embedded in order id (e.g. WOO-[channelId]-[wooOrderId])
  if (configuredSalesChannels && configuredSalesChannels.length > 0) {
    const orderIdStr = String(order.id || order.orderId || '');
    if (orderIdStr.startsWith('WOO-')) {
      const parts = orderIdStr.split('-');
      // format: WOO-[channelId]-[orderNum] or WOO-ABN-[channelId]-[orderNum]
      if (parts.length >= 3) {
        const potentialChId = parts[1] === 'ABN' ? parts[2] : parts[1];
        const matched = configuredSalesChannels.find(sc => sc.id === potentialChId || sc.name.toLowerCase() === potentialChId.toLowerCase());
        if (matched) return matched.name;
      }

      const wooChannels = configuredSalesChannels.filter(sc => sc.type === 'woocommerce' && sc.isActive);
      if (wooChannels.length === 1) {
        return wooChannels[0].name;
      }
    }

    const activeChannels = configuredSalesChannels.filter(sc => sc.isActive);
    if (activeChannels.length === 1) {
      return activeChannels[0].name;
    }
  }

  return 'المتجر الإلكتروني';
}

export function getChannelInfo(channelName: string, configuredSalesChannels?: SalesChannel[]): ChannelInfo {
  const normalized = channelName.toLowerCase().trim();

  // Check if channelName matches a configured SalesChannel from the store
  if (configuredSalesChannels && configuredSalesChannels.length > 0) {
    const matched = configuredSalesChannels.find(sc => 
      sc.name.toLowerCase().trim() === normalized ||
      sc.id.toLowerCase().trim() === normalized
    );

    if (matched) {
      const logoUrl = matched.logoUrl || matched.config?.logoUrl;

      if (matched.type === 'woocommerce') {
        return {
          id: matched.id,
          name: matched.name,
          shortName: matched.name.length > 14 ? matched.name.slice(0, 12) + '..' : matched.name,
          icon: <ShoppingBag className="w-3.5 h-3.5" />,
          logoUrl,
          bgClass: 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50',
          textClass: 'text-purple-700 dark:text-purple-300 font-bold',
          borderClass: 'border-purple-200 dark:border-purple-800',
          dotColor: 'bg-purple-500'
        };
      }
      if (matched.type === 'shopify') {
        return {
          id: matched.id,
          name: matched.name,
          shortName: matched.name.length > 14 ? matched.name.slice(0, 12) + '..' : matched.name,
          icon: <ShoppingBag className="w-3.5 h-3.5" />,
          logoUrl,
          bgClass: 'bg-lime-50 hover:bg-lime-100 dark:bg-lime-950/40 dark:hover:bg-lime-900/50',
          textClass: 'text-lime-800 dark:text-lime-300 font-bold',
          borderClass: 'border-lime-200 dark:border-lime-800',
          dotColor: 'bg-lime-600'
        };
      }
      if (matched.type === 'sheets') {
        return {
          id: matched.id,
          name: matched.name,
          shortName: matched.name.length > 14 ? matched.name.slice(0, 12) + '..' : matched.name,
          icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
          logoUrl,
          bgClass: 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50',
          textClass: 'text-emerald-700 dark:text-emerald-300 font-bold',
          borderClass: 'border-emerald-200 dark:border-emerald-800',
          dotColor: 'bg-emerald-500'
        };
      }
      return {
        id: matched.id,
        name: matched.name,
        shortName: matched.name.length > 14 ? matched.name.slice(0, 12) + '..' : matched.name,
        icon: <Store className="w-3.5 h-3.5" />,
        logoUrl,
        bgClass: 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50',
        textClass: 'text-indigo-700 dark:text-indigo-300 font-bold',
        borderClass: 'border-indigo-200 dark:border-indigo-800',
        dotColor: 'bg-indigo-500'
      };
    }
  }

  // Fallbacks for standard presets
  if (normalized.includes('facebook') || normalized.includes('meta') || normalized.includes('فيسبوك') || normalized.includes('فايسبوك')) {
    return CHANNEL_PRESETS.find(c => c.id === 'facebook_meta')!;
  }
  if (normalized.includes('instagram') || normalized.includes('انستغرام') || normalized.includes('إنستغرام')) {
    return CHANNEL_PRESETS.find(c => c.id === 'instagram')!;
  }
  if (normalized.includes('tiktok') || normalized.includes('تيك') || normalized.includes('تيكتوك')) {
    return CHANNEL_PRESETS.find(c => c.id === 'tiktok')!;
  }
  if (normalized.includes('google') || normalized.includes('جوجل')) {
    return CHANNEL_PRESETS.find(c => c.id === 'google')!;
  }
  if (normalized.includes('whatsapp') || normalized.includes('واتساب')) {
    return CHANNEL_PRESETS.find(c => c.id === 'whatsapp')!;
  }
  if (normalized.includes('youcan')) {
    return CHANNEL_PRESETS.find(c => c.id === 'youcan')!;
  }
  if (normalized.includes('woocommerce') || normalized.includes('woo')) {
    return CHANNEL_PRESETS.find(c => c.id === 'woocommerce')!;
  }
  if (normalized.includes('shopify')) {
    return CHANNEL_PRESETS.find(c => c.id === 'shopify')!;
  }
  if (normalized.includes('هاتف') || normalized.includes('phone') || normalized.includes('call') || normalized.includes('مكالمة')) {
    return CHANNEL_PRESETS.find(c => c.id === 'phone')!;
  }
  if (normalized.includes('يدوي') || normalized.includes('مباشر') || normalized.includes('direct') || normalized.includes('manual')) {
    return CHANNEL_PRESETS.find(c => c.id === 'direct_manual')!;
  }

  // Default web store fallback with custom name
  return {
    id: 'custom_' + channelName,
    name: channelName,
    shortName: channelName.length > 14 ? channelName.slice(0, 12) + '..' : channelName,
    icon: <Store className="w-3.5 h-3.5" />,
    bgClass: 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50',
    textClass: 'text-indigo-700 dark:text-indigo-300 font-bold',
    borderClass: 'border-indigo-200 dark:border-indigo-800',
    dotColor: 'bg-indigo-500'
  };
}

interface SourceChannelBadgeProps {
  order: Partial<Order>;
  size?: 'xs' | 'sm' | 'md';
  showText?: boolean;
  className?: string;
  configuredSalesChannels?: SalesChannel[];
}

export const SourceChannelBadge: React.FC<SourceChannelBadgeProps> = ({
  order,
  size = 'sm',
  showText = true,
  className = '',
  configuredSalesChannels
}) => {
  const [imageError, setImageError] = React.useState(false);
  const channelName = getOrderChannelName(order, configuredSalesChannels);
  const info = getChannelInfo(channelName, configuredSalesChannels);

  const utmTooltip = [
    order.utmCampaign ? `الحملة: ${order.utmCampaign}` : null,
    order.utmMedium ? `الوسيط: ${order.utmMedium}` : null,
    order.utmContent ? `المحتوى: ${order.utmContent}` : null,
  ].filter(Boolean).join('\n');

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px] gap-1',
    sm: 'px-2 py-0.5 text-xs gap-1.5',
    md: 'px-2.5 py-1 text-xs gap-1.5 font-bold'
  }[size];

  const imgSizeClasses = {
    xs: 'h-3.5 max-w-[28px]',
    sm: 'h-4 max-w-[36px]',
    md: 'h-5 max-w-[44px]'
  }[size];

  const displayName = info.name || channelName;
  const hasLogo = Boolean(info.logoUrl && !imageError);

  return (
    <span
      title={utmTooltip ? `${displayName}\n${utmTooltip}` : displayName}
      className={`inline-flex items-center rounded-lg border font-bold transition-all shadow-2xs whitespace-nowrap cursor-default ${info.bgClass} ${info.textClass} ${info.borderClass} ${sizeClasses} ${className}`}
    >
      {hasLogo ? (
        <img
          src={info.logoUrl}
          alt={displayName}
          className={`${imgSizeClasses} object-contain shrink-0 rounded-xs`}
          onError={() => setImageError(true)}
        />
      ) : (
        <>
          <span className="shrink-0">{info.icon}</span>
          {showText && <span>{displayName}</span>}
        </>
      )}
    </span>
  );
};

