import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { MapPin, Phone, Building } from 'lucide-react';

interface Props {
  wilayaName: string;
  communeName: string;
  deliveryCompany: string;
  isStopDesk: boolean;
}

export const ShippingDeskInfo: React.FC<Props> = ({ wilayaName, communeName, deliveryCompany, isStopDesk }) => {
  const { shippingDesks, fetchShippingDesks, shippingBureaus } = useStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (deliveryCompany && isStopDesk) {
      if (!shippingDesks[deliveryCompany]) {
        setLoading(true);
        fetchShippingDesks(deliveryCompany).finally(() => setLoading(false));
      }
    }
  }, [deliveryCompany, isStopDesk, shippingDesks, fetchShippingDesks]);

  if (!isStopDesk || !deliveryCompany || !communeName) return null;

  const desks = shippingDesks[deliveryCompany] || [];
  
  // 1. Find desk in this commune from API desks
  let communeDesk = desks.find(d => {
    if (d.location && d.location.commune) {
      return d.location.commune.toLowerCase().includes(communeName.toLowerCase()) || communeName.toLowerCase().includes(d.location.commune.toLowerCase());
    }
    if (d.commune) {
      return d.commune.toLowerCase().includes(communeName.toLowerCase()) || communeName.toLowerCase().includes(d.commune.toLowerCase());
    }
    return false;
  });

  // 2. Fallback to manually added bureaus from shippingBureaus
  if (!communeDesk && shippingBureaus && shippingBureaus.length > 0) {
    const foundBureau = shippingBureaus.find(b => {
      const matchCompany = !b.companyName || b.companyName === deliveryCompany || deliveryCompany.includes('DHD') || deliveryCompany.includes('Expedi');
      const matchWilaya = (b.wilayaName && wilayaName && (b.wilayaName.toLowerCase().includes(wilayaName.toLowerCase()) || wilayaName.toLowerCase().includes(b.wilayaName.toLowerCase()))) ||
                          (b.wilayaCode && wilayaName && wilayaName.includes(b.wilayaCode));
      const matchCommune = b.communeName ? (b.communeName.toLowerCase().includes(communeName.toLowerCase()) || communeName.toLowerCase().includes(b.communeName.toLowerCase())) : true;
      return matchCompany && matchWilaya && matchCommune;
    });

    if (foundBureau) {
      communeDesk = {
        name: foundBureau.deskName || `مكتب ${foundBureau.communeName || foundBureau.wilayaName}`,
        adresse: foundBureau.address,
        phone: foundBureau.phones?.split('\n')[0] || foundBureau.phones,
        phone2: foundBureau.phones?.split('\n')[1] || '',
        location: {
          name: foundBureau.deskName || `مكتب ${foundBureau.communeName || foundBureau.wilayaName}`,
          adresse: foundBureau.address,
          phone: foundBureau.phones,
          commune: foundBureau.communeName || communeName
        }
      };
    }
  }

  if (loading) {
    return <div className="text-xs text-gray-400 mt-2">جاري فحص توفر المكتب...</div>;
  }

  if (!communeDesk) {
    return (
      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs font-bold flex items-center gap-1.5">
        <MapPin className="w-4 h-4" />
        تنبيه: لا يوجد مكتب متوفر في هذه البلدية لشركة {deliveryCompany}.
      </div>
    );
  }

  const name = communeDesk.name || communeDesk.hub_name || communeDesk.location?.name || 'مكتب التوصيل';
  const address = communeDesk.adresse || communeDesk.location?.adresse || '';
  const phone = communeDesk.phone || communeDesk.location?.phone || '';
  const phone2 = communeDesk.phone2 || communeDesk.location?.phone2 || '';
  const mapUrl = communeDesk.map || communeDesk.location?.map || '';

  return (
    <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
      <div className="flex items-center justify-between mb-1">
         <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
           <Building className="w-4 h-4" />
           {name}
         </div>
         {mapUrl && (
           <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline flex items-center gap-1">
             <MapPin className="w-3 h-3" />
             رابط الخريطة
           </a>
         )}
      </div>
      {address && (
         <div className="text-[11px] text-emerald-700 mt-1 leading-relaxed">
           <strong>العنوان:</strong> {address}
         </div>
      )}
      {(phone || phone2) && (
         <div className="text-[11px] text-emerald-700 mt-1 flex items-center gap-2">
           <strong>الهاتف:</strong> 
           <span className="flex items-center gap-1" dir="ltr">
             <Phone className="w-3 h-3" />
             {phone} {phone2 && ' / ' + phone2}
           </span>
         </div>
      )}
    </div>
  );
};
