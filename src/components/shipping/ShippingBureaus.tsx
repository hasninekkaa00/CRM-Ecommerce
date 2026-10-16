import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { MapPin, Plus, Edit2, Trash2, Search, Building } from 'lucide-react';
import { ShippingBureau } from '../../types';

export function ShippingBureaus() {
  const { shippingBureaus, addShippingBureau, updateShippingBureau, deleteShippingBureau, settings } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const hasSeededRef = React.useRef(false);

  // Auto-seed DHD bureaus if completely empty
  useEffect(() => {
    const seedData = async () => {
      if (hasSeededRef.current) return;
      // Re-seed if length is suspiciously low (like if the previous run aborted)
      if (shippingBureaus.length < 50) {
        hasSeededRef.current = true;
        setIsInitializing(true);
        const dhdData = [
          { wilayaCode: '1', wilayaName: 'Adrar', address: 'en face lycée chikh ben abdalkarim el meghili just a coté superette ISLAM ( cité village ) - adrar', phones: '06-60-94-45-35\n06-55-72-73-65' },
          { wilayaCode: '2', wilayaName: 'Chlef', address: 'en face agence de voyage temda a 200 M de air algérie - chlef centre ville', phones: '07-70-10-59-60\n07-70-50-72-64' },
          { wilayaCode: '3', wilayaName: 'Laghouat', address: "rue ben sahnoun a cote de centre d'imagerie laghouati , cité el makam , laghouat", phones: '07-77-10-23-52\n07-70-96-47-97' },
          { wilayaCode: '4', wilayaName: 'Oum El Bouaghi', address: "Ain fekroun, a 300 m station des bus a cote de l'agence CNAS", phones: '06-57-77-00-31' },
          { wilayaCode: '5', wilayaName: 'Batna', address: 'rond point de cite 1020 lgtms la route vers CASNOS_- batna', phones: '06-62-39-94-10\n06-97-31-52-96\n06-62-32-81-80' },
          { wilayaCode: '6', wilayaName: 'Béjaïa', address: 'شارع محفوظي فاتح برنامج 250 مسكن ترقوي إقامة الصنوبر عمارة « أ » بلدية بجاية', phones: '07-70-19-01-40\n07-70-31-66-38' },
          { wilayaCode: '7', wilayaName: 'Biskra', address: 'rue des freres mennani à coté patisserie bencharif biskra', phones: '06-68-50-45-70\n06-60-83-79-69' },
          { wilayaCode: '8', wilayaName: 'Béchar', address: "centre ville just a coté de laboratoire d'analyses ABSI - BECHAR", phones: '06-72-93-89-81' },
          { wilayaCode: '9', wilayaName: 'Blida', address: '01 : chez le siège de BOUCHAMA - ouled yaich\n02 : en face ALGERIE POSTE - ouled yaich\n03 : 12 boulevard ali moukhtari - boufarik', phones: '07-70-78-81-84\n07-94-86-84-50\n07-70-84-34-79' },
          { wilayaCode: '10', wilayaName: 'Bouira', address: 'Quartier Harakat BT A , rez-de-chaussée, coopérative immobilière, belle vue - bouira', phones: '07-70-60-41-79\n06-70-10-82-12' },
          { wilayaCode: '11', wilayaName: 'Tamanrasset', address: 'حي سرسوف الطريق الجانبي للتكوين المهني ومقابل شارع طبيب العظام بن احمد', phones: '06-60-80-87-59\n06-60-93-87-59\n06-60-61-87-59' },
          { wilayaCode: '12', wilayaName: 'Tébessa', address: 'Skanska, cité el Amel derrière la grande mosquée', phones: '07-70-58-42-36' },
          { wilayaCode: '13', wilayaName: 'Tlemcen', address: '1er bureau : Rue de Chetouane en face de la rentrée du sidi othmane - sidi said\n2 eme bureau : cité chahid latti hadj ahmed a coté de terminus de la station du bus - sebdou', phones: '07-78-29-14-29\n07-70-06-89-17\n07-70-22-54-80' },
          { wilayaCode: '14', wilayaName: 'Tiaret', address: '1er bureau : طريق الفيدا قبل وكالة التشغيل القديمة بجانب صيدلية بن هني\n2 eme bureau : aprés le siége de mobilis - ksar chellala', phones: '06-72-01-03-12\n06-72-93-90-09\n07-72-44-62-41\n07-70-29-93-08' },
          { wilayaCode: '15', wilayaName: 'Tizi Ouzou', address: 'En face les bâtiments blues', phones: '05-57-29-78-72' },
          { wilayaCode: '16', wilayaName: 'Alger', address: "Birkhadem : Birkhadem, CHEMAIN ROMAIN\nCHERAGA : a cote de l'institut pastor\nREGHAIA : cité LPP bourada - reghaia\nBIRTOUTA : en face sonalgaz de birtouta\nBAB EZZOUAR : cité aadl smaill yafseh - beb ezzouar\nBAB EL OUED : En face algérie telcom et centre de formation de bab eloued", phones: '07-70-23-81-51\n07-70-01-14-56\n05-55-21-42-18\n05-57-37-97-71\n07-70-61-62-59\n07-70-10-36-96' },
          { wilayaCode: '17', wilayaName: 'Djelfa', address: "cité 05 juillet vers l'université ZIAN ACHOUR en face commisariat centrale\nAIN OUSSARA : boulvard centre formation filles a coté de dr,boukaftan - ain oussara", phones: '06-60-97-88-89\n07-82-60-83-22\n06-60-99-50-61' },
          { wilayaCode: '18', wilayaName: 'Jijel', address: 'rue akid lotfi - faubourg en face patisserie hanin - jijel', phones: '07-70-77-28-93' },
          { wilayaCode: '19', wilayaName: 'Sétif', address: 'SETIF : Cité el hidab 50 lgtms,LST,\nEULMA : à coté d un cafè STARBUCKS', phones: '05-59-53-81-49\n07-70-04-48-47' },
          { wilayaCode: '20', wilayaName: 'Saïda', address: 'كاستور مقابل جامع فاطمة الزهراء', phones: '06-55-45-72-73\n07-70-44-60-33' },
          { wilayaCode: '21', wilayaName: 'Skikda', address: 'premier bureau : a cote du centre régional du service national et du complexe des jeunes des freres SAKER\ndeuxième bureau : شارع غريب تحت الأمن الحضري الحروش', phones: '07-70-13-41-27\n06-96-71-18-88\n05-51-90-21-77' },
          { wilayaCode: '22', wilayaName: 'Sidi Bel Abbès', address: 'طريق وهران بجانب قاعة حفلات لاله زهرا مكان XD سابقا family', phones: '07-73-33-69-02\n07-70-17-21-42\n07-72-14-45-58' },
          { wilayaCode: '23', wilayaName: 'Annaba', address: 'cité AADL sidi achour , BT W04 , magasin N°03- annaba', phones: '07-74-72-95-27' },
          { wilayaCode: '24', wilayaName: 'Guelma', address: 'تحصيص 19 جوان القديم رقم 311 محل ج\n en face école privé EL NADJAH - guelma ville', phones: '07-97-80-47-45' },
          { wilayaCode: '25', wilayaName: 'Constantine', address: 'BOUTIQUE N°01 : la nouvelle ville ali mendjli BT AADL N°04 a coté de mosquée el rayan - constantine\nBOUTIQUE N°02 : أمام محور الدوران 900 الخروب', phones: '05-52-54-71-40\n05-53-81-31-33' },
          { wilayaCode: '26', wilayaName: 'Médéa', address: "pole urbain en face centre commercial\net a cote de la station d'essence ben hafri", phones: '05-53-21-20-98' },
          { wilayaCode: '27', wilayaName: 'Mostaganem', address: 'chamouma a coté controle technique automobile - mostaghanem', phones: '06-62-98-88-18' },
          { wilayaCode: '28', wilayaName: "M'Sila", address: '1 er bureau : حي سوناتكس أمام مسجد الحسن البصري\n2 éme bureau : الكادات امام مخبر تحاليل ايدير - حي بوسعادة', phones: '06-98-73-51-67\n05-41-35-67-63\n06-74-6-59-75\n06-76-86-34-21' },
          { wilayaCode: '29', wilayaName: 'Mascara', address: 'route de mizan a coté de médecin de travail - mascara', phones: '06-60-52-43-41\n06-70-26-57-11' },
          { wilayaCode: '30', wilayaName: 'Ouargla', address: 'Rue el nacer a coté du clinique dentaire boukhris', phones: '06-58-21-43-25\n07-71-26-55-19' },
          { wilayaCode: '31', wilayaName: 'Oran', address: 'akid lotfi : enface la poste pré du comissariat 9ème\nMaravel : rond point palmier just a coté de supérette trio shop', phones: '05-54-90-11-92\n07-99-13-78-03' },
          { wilayaCode: '32', wilayaName: 'El Bayadh', address: 'sur la route de MAHBOULA just a cote de sonelgaz en face la maison LG - EL BAYADH', phones: '06-59-58-60-39\n07-71-44-65-22' },
          { wilayaCode: '33', wilayaName: 'Illizi', address: "just a cote de l'APC en face veterinaire de centre ville - illizi", phones: '06-76-08-60-25' },
          { wilayaCode: '34', wilayaName: 'Bordj Bou Arreridj', address: 'cité 1 novembre soualem a coté station taxi les sources / en face la maison des jeunes', phones: '06-70-10-82-18\n07-70-32-34-86\n06-70-01-17-73' },
          { wilayaCode: '35', wilayaName: 'Boumerdès', address: 'حي فرانز فانون محل رقم 03الطابق الارضي بومرداس بجانب فندق لي ليلاس hôtel les lilas Boumerdes', phones: '07-70-35-96-59' },
          { wilayaCode: '36', wilayaName: 'El Tarf', address: 'حي الركاب بالقرب من بنك bdl مقابل دار الشباب ، الطارف', phones: '05-50-35-76-90' },
          { wilayaCode: '37', wilayaName: 'Tindouf', address: 'محل رقم 2 حي القصابي قسم 23 رقم 122 بلدية تندوف', phones: '06-70-08-13-07\n06-70-05-80-70' },
          { wilayaCode: '38', wilayaName: 'Tissemsilt', address: 'تيسمسيلت مقابل المجموعة الإقليمية للدرك الوطني', phones: '06-63-29-99-97' },
          { wilayaCode: '39', wilayaName: 'El Oued', address: 'حي الرمال طريق النزل المالي مقابل بزار يانوفا بجانب مطعم الحكاية', phones: '05-61-40-11-10\n07-90-16-53-93' },
          { wilayaCode: '40', wilayaName: 'Khenchela', address: 'بجانب مديرية المجاهدين و المجلس الشعبي البلدي belle vue', phones: '07-70-63-72-90\n06-60-41-82-93' },
          { wilayaCode: '41', wilayaName: 'Souk Ahras', address: "04 Route d'Alger, face au DR.KHELIFI - souk ahras", phones: '07-70-54-64-13\n05-50-43-63-98' },
          { wilayaCode: '42', wilayaName: 'Tipaza', address: "Aadl 1700 Block 29 local c3 a coté de comesariat- tipaza\nKOLEA : rue bounatirou djeloul just a coté de l'ancien stade ( chemin neuf )", phones: '05-42-03-90-62\n07-70-59-82-50\n06-72-47-60-11' },
          { wilayaCode: '43', wilayaName: 'Mila', address: 'ميلة امام محور الدوران بوصوف طريق زغاية', phones: '07-70-17-77-72' },
          { wilayaCode: '44', wilayaName: 'Aïn Defla', address: 'cité nadjem mohamed , en face hotel NADJEM\n2 éme bureau : Adresse : طريق القايد تحت كوندور - khemis meliana', phones: '06-99-68-77-15\n07-74-13-79-82\n07-97-01-52-17' },
          { wilayaCode: '45', wilayaName: 'Naâma', address: '14 rue akid amirouche cité khemisti el macheria - naama', phones: '06-60-97-35-92\n06-60-97-35-71' },
          { wilayaCode: '46', wilayaName: 'Aïn Témouchent', address: 'promotion immobilière tounsi , résidence belair - ain temouchent', phones: '05-51-67-11-63' },
          { wilayaCode: '47', wilayaName: 'Ghardaïa', address: 'Rue cheikh abdelaziz el Thamini en face du collége cheikh 3 ben yazgen , ghardaia', phones: '06-99-47-47-37\n05-41-88-83-30' },
          { wilayaCode: '48', wilayaName: 'Relizane', address: 'Boulevard Zemmoura ( en face CEM NOUVEAU ) RELIZAN', phones: '05-62-71-81-66\n05-49-10-50-89' },
          { wilayaCode: '49', wilayaName: 'Timimoun', address: 'تميمون بجوار المركز الطبي سونطراك', phones: '06-55-72-73-65' },
          { wilayaCode: '51', wilayaName: 'Ouled Djellal', address: 'شارع قاسمي ابراهيم خلف عيادة قاسمي ابراهيم اولادجلال', phones: '07-74-66-84-72' },
          { wilayaCode: '52', wilayaName: 'Béni Abbès', address: '/', phones: '' },
          { wilayaCode: '53', wilayaName: 'In Salah', address: 'centre ville rue radar en face superette ben hamadi IN SALAH', phones: '06-59-77-87-97' },
          { wilayaCode: '55', wilayaName: 'Touggourt', address: 'city el bahdja 630 logt en face gendrame - touggourt', phones: '05-50-39-72-27\n07-81-58-97-71' },
          { wilayaCode: '57', wilayaName: "El M'Ghair", address: '/', phones: '' },
          { wilayaCode: '58', wilayaName: 'El Meniaa', address: 'محل رقم 39 جنان البايليك - المنيعة', phones: '05-58-01-51-66\n06-62-92-09-05' },
        ];

        try {
          const mappedBureaus = dhdData.map(data => ({
            id: `dhd-${data.wilayaCode}`,
            ...data
          }));
          const { bulkUpsertShippingBureaus } = useStore.getState();
          if (bulkUpsertShippingBureaus) {
            await bulkUpsertShippingBureaus(mappedBureaus);
          }
        } catch (e) {
          console.error("Failed to seed bureaus", e);
        } finally {
          setIsInitializing(false);
        }
      }
    };
    seedData();
  }, []);

  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBureau, setEditingBureau] = useState<ShippingBureau | null>(null);
  const [formData, setFormData] = useState({
    wilayaCode: '',
    wilayaName: '',
    address: '',
    phones: ''
  });

  const filteredBureaus = shippingBureaus.filter(b => 
    b.wilayaCode.includes(searchTerm) || 
    b.wilayaName.includes(searchTerm) ||
    b.address.includes(searchTerm)
  );

  const handleOpenModal = (bureau?: ShippingBureau) => {
    if (bureau) {
      setEditingBureau(bureau);
      setFormData({
        wilayaCode: bureau.wilayaCode || '',
        wilayaName: bureau.wilayaName || '',
        address: bureau.address || '',
        phones: bureau.phones || ''
      });
    } else {
      setEditingBureau(null);
      setFormData({
        wilayaCode: '',
        wilayaName: '',
        address: '',
        phones: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingBureau) {
        await updateShippingBureau(editingBureau.id, formData);
      } else {
        await addShippingBureau({
          id: Date.now().toString(),
          ...formData
        });
      }
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء الحفظ');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المكتب؟')) {
      await deleteShippingBureau(id);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-right" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2 mb-2">
            <Building className="w-6 h-6 text-indigo-600" />
            مكاتب شركة الشحن (DHD)
          </h2>
          <p className="text-gray-500 text-sm font-medium">الدليل الشامل لعناوين مكاتب الشركة وأرقام التواصل عبر الولايات</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow hover:bg-indigo-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          إضافة مكتب جديد
        </button>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <div className="relative mb-6">
          <Search className="w-5 h-5 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="بحث بالكود، الولاية، أو العنوان..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-12 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-medium transition-all"
          />
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="py-4 px-4 font-bold text-gray-500 border-b border-gray-100 w-24">كود الولاية</th>
                <th className="py-4 px-4 font-bold text-gray-500 border-b border-gray-100 w-48">الولاية</th>
                <th className="py-4 px-4 font-bold text-gray-500 border-b border-gray-100">عنوان المكتب</th>
                <th className="py-4 px-4 font-bold text-gray-500 border-b border-gray-100 w-48">أرقام الهواتف</th>
                <th className="py-4 px-4 font-bold text-gray-500 border-b border-gray-100 w-24">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredBureaus.length > 0 ? filteredBureaus.map(bureau => (
                <tr key={bureau.id} className="hover:bg-gray-50/30 transition-colors">
                  <td className="py-4 px-4 font-black text-gray-900">{bureau.wilayaCode}</td>
                  <td className="py-4 px-4 font-bold text-gray-800">{bureau.wilayaName}</td>
                  <td className="py-4 px-4 text-gray-600 text-sm leading-relaxed">{bureau.address}</td>
                  <td className="py-4 px-4">
                    <div className="flex flex-col gap-1">
                      {bureau.phones.split('\n').map((phone, i) => (
                        <a key={i} href={`tel:${phone.trim()}`} className="text-indigo-600 hover:text-indigo-800 font-mono text-sm block" dir="ltr" style={{ textAlign: 'right' }}>
                          {phone.trim()}
                        </a>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleOpenModal(bureau)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(bureau.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400 font-medium bg-gray-50/30 rounded-xl">
                    <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    لا توجد مكاتب مسجلة حالياً
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
            <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
              <Building className="w-6 h-6 text-indigo-600" />
              {editingBureau ? 'تعديل بيانات المكتب' : 'إضافة مكتب جديد'}
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">كود الولاية</label>
                  <input 
                    type="text" 
                    value={formData.wilayaCode ?? ''}
                    onChange={(e) => setFormData({...formData, wilayaCode: e.target.value})}
                    className="w-full border-gray-200 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-bold transition-all text-left"
                    dir="ltr"
                    placeholder="مثال: 16"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">اسم الولاية</label>
                  <input 
                    type="text" 
                    value={formData.wilayaName ?? ''}
                    onChange={(e) => setFormData({...formData, wilayaName: e.target.value})}
                    className="w-full border-gray-200 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-bold transition-all"
                    placeholder="مثال: Alger"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">عنوان المكتب بالتفصيل</label>
                <textarea 
                  value={formData.address ?? ''}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  rows={3}
                  className="w-full border-gray-200 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-medium transition-all"
                  placeholder="العنوان ومكان المكتب..."
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">أرقام الهواتف (كل رقم في سطر)</label>
                <textarea 
                  value={formData.phones ?? ''}
                  onChange={(e) => setFormData({...formData, phones: e.target.value})}
                  rows={3}
                  dir="ltr"
                  className="w-full border-gray-200 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-mono transition-all text-left"
                  placeholder="07-70-01-14-56&#10;05-55-21-42-18"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100 shrink-0">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="flex-[0.4] px-4 py-3 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                إلغاء
              </button>
              <button 
                onClick={handleSave} 
                disabled={!formData.wilayaCode || !formData.wilayaName}
                className="flex-[0.6] px-4 py-3 font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-all shadow-lg shadow-indigo-200"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
