import { Campaign, CampaignRecord, CampaignField } from '../types';

export const fetchAndMapMetaMetrics = (
    data: any, 
    currentFields: CampaignField[]
): { spend: number, date: string, metrics: Record<string, number> }[] => {
    
    if (!data || !data.data || data.data.length === 0) {
        return [];
    }

    const results = [];
    
    for (const record of data.data) {
        const spend = parseFloat(record.spend);
        if (spend <= 0) continue;

        const metrics: Record<string, any> = {};
        const getFieldId = (name: string) => currentFields.find(f => f.name.toLowerCase() === name.toLowerCase())?.id;
        
        const mapMetric = (metaKey: string, fieldName: string) => {
            const fId = getFieldId(fieldName);
            if (fId && record[metaKey] !== undefined) {
                metrics[fId] = parseFloat(record[metaKey]);
            }
        };
        
        mapMetric('impressions', 'impressions');
        mapMetric('reach', 'reach');
        mapMetric('cpm', 'cpm');
        mapMetric('clicks', 'link clicks');
        mapMetric('cpc', 'cpc');
        mapMetric('ctr', 'ctr');
        
        if (record.actions) {
            const purchases = record.actions.find((a:any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase');
            if (purchases) {
                const fId = getFieldId('purchases');
                if (fId) metrics[fId] = parseFloat(purchases.value);
            }
            
            const lpvs = record.actions.find((a:any) => a.action_type === 'landing_page_view');
            if (lpvs) {
                const fId = getFieldId('landing page views');
                if (fId) metrics[fId] = parseFloat(lpvs.value);
            }
        }
    
        if (record.cost_per_action_type) {
            const costPerPurchase = record.cost_per_action_type.find((a:any) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase');
            if (costPerPurchase) {
                const fId = getFieldId('cost per purchase');
                if (fId) metrics[fId] = parseFloat(costPerPurchase.value);
            }
        }

        results.push({
            spend,
            date: record.date_start,
            metrics
        });
    }

    return results;
};
