import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

const LOCAL_STORAGE_KEY = 'dentiscan_offline_queue';

export default function App() {
  const EXPORT_PASSCODE = '1234';

  // ใช้สำหรับเลื่อนหน้าจออัตโนมัติบนมือถือ
  const topRef = useRef<HTMLDivElement>(null);

  // สลับหน้าจอ: 'form' (แบบฟอร์ม) | 'dashboard' (สรุปสถิติ) | 'history' (ค้นหาและแก้ไขประวัติ)
  const [activeTab, setActiveTab] = useState<'form' | 'dashboard' | 'history'>('form');

  // ตัวกรองเลือกตำบลสำหรับหน้า Dashboard
  const [selectedDashboardTambon, setSelectedDashboardTambon] = useState<string>('ทั้งหมด');

  // สถานะสำหรับโหมดแก้ไขประวัติ
  const [editingId, setEditingId] = useState<string | null>(null);

  // คำค้นหาในหน้าประวัติ
  const [searchQuery, setSearchQuery] = useState('');

  // สถานะสำหรับ Modal ใบสรุปผลคัดกรองส่วนบุคคล (Print Slip)
  const [printData, setPrintData] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    cid: '',
    fullname: '',
    age: '',
    tambon: 'ตำบลสมเด็จ',
    moo: '1',
    weight: '',
    height: '',
    total_teeth: 28,
    posterior_occlusion: 0,
    filled_teeth: 0,
    extracted_teeth: 0,
    periodontal_status: 'ปกติ',
    bleeding_on_brushing: false,
    has_calculus: false,
    mobile_teeth: 0,
    need_fluoride: false,
    need_scaling: false,
    need_fill_count: 0,
    need_ext_count: 0,
    denture_need: 'ไม่ต้องใส่',
    lesion_normal: true,
    lesion_red: false,
    lesion_white: false,
    lesion_mass: false,
    lesion_ulcer: false,
    triage_level: 'ปกติ (🟢)',
    examiner_name: '',
  });

  const [exporterName, setExporterName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 🌐 ระบบ Offline / Online State
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // 🔎 ตรวจสอบข้อมูลซ้ำ
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState<boolean>(false);

  // สถิติประจำวัน & ข้อมูลทั้งหมด
  const [todayCount, setTodayCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);
  const [allData, setAllData] = useState<any[]>([]);

  useEffect(() => {
    const savedQueue = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedQueue) {
      try {
        setOfflineQueue(JSON.parse(savedQueue));
      } catch (e) {
        console.error('Failed to parse offline queue', e);
      }
    }

    const handleOnline = () => {
      setIsOnline(true);
      setMessage('🟢 เชื่อมต่ออินเทอร์เน็ตแล้ว! กำลังเตรียมซิงค์ข้อมูล...');
      setTimeout(() => setMessage(''), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setMessage('🟠 อยู่ในโหมดออฟไลน์: ข้อมูลจะถูกบันทึกไว้ในเครื่องชั่วคราว');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    fetchDataAndStats();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline && offlineQueue.length > 0 && !isSyncing) {
      syncOfflineData();
    }
  }, [isOnline, offlineQueue]);

  useEffect(() => {
    if (!editingId && formData.cid.length === 13) {
      checkDuplicateCID(formData.cid);
    } else {
      setDuplicateWarning(null);
    }
  }, [formData.cid, isOnline, offlineQueue, editingId]);

  const scrollToTop = () => {
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const saveQueueToStorage = (queue: any[]) => {
    setOfflineQueue(queue);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(queue));
  };

  const fetchDataAndStats = async () => {
    if (!navigator.onLine) return;
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase.from('dental_screenings').select('*').order('created_at', { ascending: false });

    if (!error && data) {
      setAllData(data);
      const todayRecords = data.filter((item: any) =>
        item.created_at && item.created_at.startsWith(today)
      );
      setTodayCount(todayRecords.length);

      const urgent = data.filter((item: any) =>
        item.triage_level && item.triage_level.includes('เร่งด่วน')
      ).length;
      setUrgentCount(urgent);
    }
  };

  const checkDuplicateCID = async (cid: string) => {
    setIsCheckingDuplicate(true);
    setDuplicateWarning(null);

    const offlineMatch = offlineQueue.find((item) => item.cid === cid);
    if (offlineMatch) {
      setDuplicateWarning(
        `⚠️ พบข้อมูลซ้ำในคิวออฟไลน์: ${offlineMatch.fullname || 'ไม่ระบุชื่อ'} (รอยืนยันซิงค์)`
      );
      setIsCheckingDuplicate(false);
      return;
    }

    if (isOnline) {
      const { data, error } = await supabase
        .from('dental_screenings')
        .select('fullname, created_at')
        .eq('cid', cid)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const lastRecord = data[0];
        const recordDate = new Date(lastRecord.created_at).toLocaleDateString('th-TH');
        setDuplicateWarning(
          `⚠️ เคยตรวจแล้วเมื่อ ${recordDate}: คุณ${lastRecord.fullname || 'ไม่ระบุชื่อ'}`
        );
      }
    }
    setIsCheckingDuplicate(false);
  };

  const syncOfflineData = async () => {
    if (offlineQueue.length === 0 || !navigator.onLine) return;

    setIsSyncing(true);
    let successCount = 0;
    const remainingQueue = [...offlineQueue];

    for (let i = 0; i < offlineQueue.length; i++) {
      const item = offlineQueue[i];
      const { _offline_id, _created_at, id, ...dataToInsert } = item;

      let error = null;
      if (id) {
        const res = await supabase.from('dental_screenings').update(dataToInsert).eq('id', id);
        error = res.error;
      } else {
        const res = await supabase.from('dental_screenings').insert([{ ...dataToInsert, created_at: _created_at }]);
        error = res.error;
      }

      if (!error) {
        successCount++;
        remainingQueue.shift();
      } else {
        console.error('Sync failed:', error);
        break;
      }
    }

    saveQueueToStorage(remainingQueue);
    setIsSyncing(false);

    if (successCount > 0) {
      setMessage(`✨ ซิงค์ข้อมูลออฟไลน์สำเร็จ ${successCount} รายการ! 🚀`);
      fetchDataAndStats();
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const handleSmartCardScan = () => {
    const mockScans = [
      { cid: '3460100987651', fullname: 'นายสมชาย รักสะอาด', age: '45' },
      { cid: '1469900123452', fullname: 'นางสาววิไลพร ใจดี', age: '32' },
      { cid: '3460500112233', fullname: 'นายบุญมา พาเพลิน', age: '58' },
    ];
    const randomScan = mockScans[Math.floor(Math.random() * mockScans.length)];
    
    setFormData((prev) => ({
      ...prev,
      cid: randomScan.cid,
      fullname: randomScan.fullname,
      age: randomScan.age,
    }));
    setMessage(`📷 สแกนบัตรสำเร็จ: ${randomScan.fullname}`);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      if (field === 'total_teeth' && Number(value) === 0) {
        updated.denture_need = 'ฟันปลอมทั้งปาก';
      }

      if ((field === 'has_calculus' || field === 'bleeding_on_brushing') && value === true) {
        updated.periodontal_status = 'เหงือกอักเสบ/มีหินปูน';
        updated.need_scaling = true;
      }

      return updated;
    });
  };

  const handleCounter = (field: string, change: number) => {
    setFormData((prev: any) => {
      const newValue = Math.max(0, Number(prev[field]) + change);
      const updated = { ...prev, [field]: newValue };

      if (field === 'total_teeth' && newValue === 0) {
        updated.denture_need = 'ฟันปลอมทั้งปาก';
      }
      return updated;
    });
  };

  const handleQuickPreset = (presetType: string) => {
    if (presetType === 'full28') {
      setFormData((prev) => ({ ...prev, total_teeth: 28, extracted_teeth: 0 }));
    } else if (presetType === 'full32') {
      setFormData((prev) => ({ ...prev, total_teeth: 32, extracted_teeth: 0 }));
    } else if (presetType === 'none') {
      setFormData((prev) => ({
        ...prev,
        total_teeth: 0,
        posterior_occlusion: 0,
        denture_need: 'ฟันปลอมทั้งปาก',
      }));
    }
  };

  const handleLesionChange = (field: string, checked: boolean) => {
    if (field === 'lesion_normal' && checked) {
      setFormData((prev) => ({
        ...prev,
        lesion_normal: true,
        lesion_red: false,
        lesion_white: false,
        lesion_mass: false,
        lesion_ulcer: false,
      }));
    } else {
      setFormData((prev) => {
        const isAnyLesion =
          (field === 'lesion_red' && checked) ||
          (field === 'lesion_white' && checked) ||
          (field === 'lesion_mass' && checked) ||
          (field === 'lesion_ulcer' && checked) ||
          prev.lesion_red || prev.lesion_white || prev.lesion_mass || prev.lesion_ulcer;

        return {
          ...prev,
          [field]: checked,
          lesion_normal: checked ? false : prev.lesion_normal,
          triage_level: isAnyLesion ? 'เร่งด่วน/ส่งต่อ (🔴)' : prev.triage_level,
        };
      });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData((prev) => ({
      ...prev,
      cid: '',
      fullname: '',
      age: '',
      tambon: 'ตำบลสมเด็จ',
      moo: '1',
      weight: '',
      height: '',
      total_teeth: 28,
      posterior_occlusion: 0,
      filled_teeth: 0,
      extracted_teeth: 0,
      periodontal_status: 'ปกติ',
      bleeding_on_brushing: false,
      has_calculus: false,
      mobile_teeth: 0,
      need_fluoride: false,
      need_scaling: false,
      need_fill_count: 0,
      need_ext_count: 0,
      denture_need: 'ไม่ต้องใส่',
      lesion_normal: true,
      lesion_red: false,
      lesion_white: false,
      lesion_mass: false,
      lesion_ulcer: false,
      triage_level: 'ปกติ (🟢)',
    }));
    setDuplicateWarning(null);
  };

  const handleEditRecord = (record: any) => {
    setEditingId(record.id || record._offline_id);
    setFormData({
      cid: record.cid || '',
      fullname: record.fullname || '',
      age: record.age || '',
      tambon: record.tambon || 'ตำบลสมเด็จ',
      moo: record.moo || '1',
      weight: record.weight || '',
      height: record.height || '',
      total_teeth: record.total_teeth ?? 28,
      posterior_occlusion: record.posterior_occlusion ?? 0,
      filled_teeth: record.filled_teeth ?? 0,
      extracted_teeth: record.extracted_teeth ?? 0,
      periodontal_status: record.periodontal_status || 'ปกติ',
      bleeding_on_brushing: !!record.bleeding_on_brushing,
      has_calculus: !!record.has_calculus,
      mobile_teeth: record.mobile_teeth ?? 0,
      need_fluoride: !!record.need_fluoride,
      need_scaling: !!record.need_scaling,
      need_fill_count: record.need_fill_count ?? 0,
      need_ext_count: record.need_ext_count ?? 0,
      denture_need: record.denture_need || 'ไม่ต้องใส่',
      lesion_normal: record.lesion_normal ?? true,
      lesion_red: !!record.lesion_red,
      lesion_white: !!record.lesion_white,
      lesion_mass: !!record.lesion_mass,
      lesion_ulcer: !!record.lesion_ulcer,
      triage_level: record.triage_level || 'ปกติ (🟢)',
      examiner_name: record.examiner_name || '',
    });
    setActiveTab('form');
    setMessage(`✏️ กำลังแก้ไขข้อมูลของ: ${record.fullname}`);
    scrollToTop();
    setTimeout(() => setMessage(''), 4000);
  };

  const handleDeleteRecord = async (record: any) => {
    const confirmDel = window.confirm(`คุณต้องการลบประวัติการตรวจของ "${record.fullname}" ใช่หรือไม่?`);
    if (!confirmDel) return;

    if (record._offline_id) {
      const updatedQueue = offlineQueue.filter((item) => item._offline_id !== record._offline_id);
      saveQueueToStorage(updatedQueue);
      setMessage('🗑️ ลบข้อมูลในคิวออฟไลน์สำเร็จ');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (isOnline && record.id) {
      const { error } = await supabase.from('dental_screenings').delete().eq('id', record.id);
      if (error) {
        alert('ลบไม่สำเร็จ: ' + error.message);
      } else {
        setMessage('🗑️ ลบข้อมูลในระบบออนไลน์สำเร็จ');
        fetchDataAndStats();
        setTimeout(() => setMessage(''), 3000);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.cid.length !== 13) {
      alert('กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก');
      return;
    }
    if (!formData.examiner_name.trim()) {
      alert('กรุณาระบุชื่อผู้ตรวจ');
      return;
    }

    if (!editingId && duplicateWarning) {
      const confirmSave = window.confirm(
        `${duplicateWarning}\n\nคุณต้องการบันทึกข้อมูลการตรวจครั้งใหม่นี้ซ้ำอีกหรือไม่?`
      );
      if (!confirmSave) return;
    }

    setLoading(true);
    setMessage('');

    const currentSavedData = { ...formData, created_at: new Date().toISOString() };

    if (!isOnline) {
      if (editingId) {
        const updatedQueue = offlineQueue.map((item) =>
          item._offline_id === editingId || item.id === editingId ? { ...formData, _offline_id: editingId, _created_at: item._created_at || new Date().toISOString() } : item
        );
        saveQueueToStorage(updatedQueue);
      } else {
        const offlineItem = {
          ...formData,
          _offline_id: Date.now().toString(),
          _created_at: new Date().toISOString(),
        };
        saveQueueToStorage([...offlineQueue, offlineItem]);
      }
      setLoading(false);
      setMessage(`📦 บันทึกข้อมูลเรียบร้อย (ออฟไลน์) 💜`);
      setPrintData(currentSavedData);
      resetForm();
      scrollToTop();
      setTimeout(() => setMessage(''), 3500);
      return;
    }

    let error = null;
    if (editingId && !String(editingId).includes('-')) {
      const res = await supabase.from('dental_screenings').update(formData).eq('id', editingId);
      error = res.error;
    } else {
      const res = await supabase.from('dental_screenings').insert([formData]);
      error = res.error;
    }

    setLoading(false);
    if (error) {
      alert('บันทึกไม่สำเร็จ: ' + error.message);
    } else {
      setMessage(editingId ? `✨ อัปเดตข้อมูลเรียบร้อยแล้วค่ะ! 💜` : `✨ บันทึกข้อมูลเรียบร้อยแล้วค่ะ! 💜`);
      setPrintData(currentSavedData);
      resetForm();
      fetchDataAndStats();
      scrollToTop();
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleConfirmExport = async () => {
    if (!exporterName.trim()) {
      alert('กรุณากรอกชื่อเจ้าหน้าที่ผู้ส่งออกข้อมูล');
      return;
    }

    if (passcode !== EXPORT_PASSCODE) {
      alert('🔒 รหัสยืนยันไม่ถูกต้อง! กรุณาตรวจสอบรหัสอีกครั้ง');
      return;
    }

    let exportData: any[] = [];

    if (isOnline) {
      const { data, error } = await supabase.from('dental_screenings').select('*');
      if (error) {
        alert('ดึงข้อมูลจากออนไลน์ไม่สำเร็จ: ' + error.message);
        return;
      }
      exportData = data || [];
    }

    if (offlineQueue.length > 0) {
      const offlineFormatted = offlineQueue.map((item) => ({
        ...item,
        created_at: item._created_at || new Date().toISOString(),
      }));
      exportData = [...exportData, ...offlineFormatted];
    }

    if (exportData.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    const headers = [
      'วันที่ตรวจ', 'เลขบัตรประชาชน', 'ชื่อสกุล', 'อายุ(ปี)', 'ตำบล', 'หมู่ที่',
      'น้ำหนัก(กก.)', 'ส่วนสูง(ซม.)',
      'ฟันแท้(ซี่)', 'คู่สบฟันหลัง(คู่)', 'อุดแล้ว(ซี่)', 'ถอนแล้ว(ซี่)',
      'สภาวะปริทันต์', 'เลือดออกขณะแปรง(BOP)', 'มีหินปูน(Calculus)', 'ฟันโยก(ซี่)',
      'เคลือบฟลูออไรด์(F)', 'ขูดหินปูน', 'จำเป็นต้องอุด(ซี่)', 'จำเป็นต้องถอน(ซี่)',
      'ความต้องการฟันปลอม',
      'รอยโรคปกติ', 'รอยโรคสีแดง', 'รอยโรคสีขาว', 'มีก้อน/ไตแข็ง', 'แผลไม่หายใน2สัปดาห์',
      'ระดับความเร่งด่วน', 'ผู้ตรวจ', 'ผู้ส่งออกข้อมูล'
    ];

    const csvRows = exportData.map((item) => [
      `"${new Date(item.created_at || Date.now()).toLocaleDateString('th-TH')}"`,
      `"\t${item.cid}"`,
      `"${item.fullname}"`,
      item.age || '',
      `"${item.tambon || ''}"`,
      `"${item.moo}"`,
      item.weight || '',
      item.height || '',
      item.total_teeth || 0,
      item.posterior_occlusion || 0,
      item.filled_teeth || 0,
      item.extracted_teeth || 0,
      `"${item.periodontal_status || 'ปกติ'}"`,
      item.bleeding_on_brushing ? 'มี' : 'ไม่มี',
      item.has_calculus ? 'มี' : 'ไม่มี',
      item.mobile_teeth || 0,
      item.need_fluoride ? 'ทำ' : 'ไม่ทำ',
      item.need_scaling ? 'ทำ' : 'ไม่ทำ',
      item.need_fill_count || 0,
      item.need_ext_count || 0,
      `"${item.denture_need || 'ไม่ต้องใส่'}"`,
      item.lesion_normal ? 'ปกติ' : 'พบรอยโรค',
      item.lesion_red ? 'พบ' : 'ไม่พบ',
      item.lesion_white ? 'พบ' : 'ไม่พบ',
      item.lesion_mass ? 'พบ' : 'ไม่พบ',
      item.lesion_ulcer ? 'พบ' : 'ไม่พบ',
      `"${item.triage_level || 'ปกติ (🟢)'}"`,
      `"${item.examiner_name || ''}"`,
      `"${exporterName}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Dental_Export_By_${exporterName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setPasscode('');
    setShowExportModal(false);
  };

  const isTeethOverLimit = (Number(formData.total_teeth) + Number(formData.extracted_teeth)) > 32;

  const rawCombinedData = [...allData, ...offlineQueue];
  const tambonList = [
    'ตำบลสมเด็จ', 'ตำบลหนองแวง', 'ตำบลแซงบาดาล', 'ตำบลมหาไชย',
    'ตำบลหมูม่น', 'ตำบลผาเสวย', 'ตำบลศรีสมเด็จ', 'ตำบลลำห้วยหลัว'
  ];

  const dashboardData = selectedDashboardTambon === 'ทั้งหมด'
    ? rawCombinedData
    : rawCombinedData.filter((i) => i.tambon === selectedDashboardTambon);

  const totalCount = dashboardData.length;
  const denturePartialCount = dashboardData.filter((i) => i.denture_need === 'ฟันปลอมบางส่วน').length;
  const dentureFullCount = dashboardData.filter((i) => i.denture_need === 'ฟันปลอมทั้งปาก').length;
  const bopCount = dashboardData.filter((i) => i.bleeding_on_brushing).length;
  const calculusCount = dashboardData.filter((i) => i.has_calculus).length;
  const needScalingCount = dashboardData.filter((i) => i.need_scaling).length;
  const needFluorideCount = dashboardData.filter((i) => i.need_fluoride).length;
  const urgentTriageCount = dashboardData.filter((i) => i.triage_level && i.triage_level.includes('เร่งด่วน')).length;
  const lesionRedCount = dashboardData.filter((i) => i.lesion_red).length;
  const lesionWhiteCount = dashboardData.filter((i) => i.lesion_white).length;
  const lesionMassCount = dashboardData.filter((i) => i.lesion_mass).length;
  const lesionUlcerCount = dashboardData.filter((i) => i.lesion_ulcer).length;

  const filteredHistory = rawCombinedData.filter((item) => {
    const q = searchQuery.toLowerCase();
    const cidMatch = item.cid && item.cid.toLowerCase().includes(q);
    const nameMatch = item.fullname && item.fullname.toLowerCase().includes(q);
    const tambonMatch = item.tambon && item.tambon.toLowerCase().includes(q);
    return cidMatch || nameMatch || tambonMatch;
  });

  return (
    <div ref={topRef} style={styles.bgContainer}>
      <div style={styles.backgroundWatermark}>
        DEVELOPED BY SARANRAK KAMPIROM
      </div>

      <div style={styles.card}>
        {/* 🌐 แถบสถานะเน็ต */}
        <div style={{
          ...styles.networkBanner,
          backgroundColor: isOnline ? '#ecfdf5' : '#fff7ed',
          borderColor: isOnline ? '#a7f3d0' : '#ffedd5',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px' }}>{isOnline ? '🟢' : '🟠'}</span>
            <span style={{
              fontSize: '11.5px',
              fontWeight: '700',
              color: isOnline ? '#047857' : '#c2410c'
            }}>
              {isOnline ? 'ออนไลน์' : 'ออฟไลน์ (ลงพื้นที่)'}
            </span>
          </div>

          {offlineQueue.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={styles.badgeCount}>ค้างส่ง {offlineQueue.length} รายการ</span>
              {isOnline && (
                <button
                  type="button"
                  onClick={syncOfflineData}
                  disabled={isSyncing}
                  style={styles.syncBtn}
                >
                  {isSyncing ? 'กำลังซิงค์...' : '🔄 ซิงค์ขึ้นคลาวด์'}
                </button>
              )}
            </div>
          )}
        </div>

        <header style={styles.header}>
          <div style={styles.iconCircle}>✨🦷✨</div>
          <h1 style={styles.title}>DentiScan Pro</h1>
          <p style={styles.subtitle}>🌿 ระบบตรวจคัดกรองสุขภาพช่องปากเชิงรุก 💜</p>
        </header>

        {/* 🔘 Tab Navigation */}
        <div style={styles.tabContainer3}>
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            style={activeTab === 'form' ? styles.activeTabBtn : styles.inactiveTabBtn}
          >
            📋 ฟอร์มตรวจ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            style={activeTab === 'dashboard' ? styles.activeTabBtn : styles.inactiveTabBtn}
          >
            📊 สถิติ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            style={activeTab === 'history' ? styles.activeTabBtn : styles.inactiveTabBtn}
          >
            🔍 ประวัติ/แก้ไข
          </button>
        </div>

        {/* ==================== 1. ฟอร์มตรวจ ==================== */}
        {activeTab === 'form' && (
          <>
            <div style={styles.statsBar}>
              <div style={styles.statBox}>
                <span style={styles.statNumber}>{todayCount}</span>
                <span style={styles.statLabel}>ตรวจวันนี้ (ราย)</span>
              </div>
              <div style={styles.statDivider} />
              <div style={styles.statBox}>
                <span style={{ ...styles.statNumber, color: '#dc2626' }}>{urgentCount}</span>
                <span style={styles.statLabel}>เคสเร่งด่วน (ราย)</span>
              </div>
            </div>

            {message && <div style={styles.alertBox}>{message}</div>}

            {printData && (
              <div style={styles.printPromptCard}>
                <span>✨ บันทึกข้อมูลเรียบร้อยแล้ว ต้องการพิมพ์ใบสรุปผลไหมคะ?</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => setPrintData(null)} style={styles.skipPrintBtn}>ข้าม</button>
                  <button type="button" onClick={() => window.print()} style={styles.nowPrintBtn}>🖨️ พิมพ์ใบสรุปผล</button>
                </div>
              </div>
            )}

            {editingId && (
              <div style={styles.editingBanner}>
                <span>✏️ กำลังแก้ไขข้อมูลเดิม (ID: {editingId.slice(-6)})</span>
                <button type="button" onClick={resetForm} style={styles.cancelEditBtn}>ยกเลิกแก้ไข</button>
              </div>
            )}

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.examinerCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={styles.examinerLabel}>
                    🩺 เจ้าหน้าที่ผู้ตรวจ <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span style={{ fontSize: '11px', color: '#6d28d9', fontWeight: '500' }}>🔒 จำค่าไว้อัตโนมัติ</span>
                </div>
                <input
                  type="text"
                  value={formData.examiner_name}
                  onChange={(e) => handleChange('examiner_name', e.target.value)}
                  placeholder="ระบุชื่อผู้ตรวจ (เช่น ทพญ.สมหญิง / นักวิชาการฯ)"
                  required
                  style={styles.examinerInput}
                />
              </div>

              {/* 🆔 เลขบัตรประชาชน + ปุ่มสแกนบัตร */}
              <div style={styles.fieldGroup}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={styles.label}>🆔 เลขบัตรประชาชน 13 หลัก <span style={{ color: '#ef4444' }}>*</span></label>
                  <button
                    type="button"
                    onClick={handleSmartCardScan}
                    style={styles.scanBtn}
                  >
                    📷 สแกน/จำลองบัตร ปชช.
                  </button>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={13}
                  value={formData.cid}
                  onChange={(e) => handleChange('cid', e.target.value)}
                  placeholder="x-xxxx-xxxxx-xx-x"
                  required
                  style={{
                    ...styles.input,
                    borderColor: duplicateWarning ? '#f97316' : '#e5e7eb',
                    backgroundColor: duplicateWarning ? '#fff7ed' : '#fafafa',
                  }}
                />
                {duplicateWarning && (
                  <div style={styles.duplicateWarningBox}>
                    <span>{duplicateWarning}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 3, ...styles.fieldGroup }}>
                  <label style={styles.label}>👤 ชื่อ - สกุล <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="text"
                    value={formData.fullname}
                    onChange={(e) => handleChange('fullname', e.target.value)}
                    placeholder="สมชาย ใจดี"
                    required
                    style={styles.input}
                  />
                </div>
                <div style={{ flex: 1.2, ...styles.fieldGroup }}>
                  <label style={styles.label}>🎂 อายุ</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.age}
                    onChange={(e) => handleChange('age', e.target.value)}
                    placeholder="ปี"
                    style={{ ...styles.input, textAlign: 'center' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 2, ...styles.fieldGroup }}>
                  <label style={styles.label}>📍 ตำบล</label>
                  <select
                    value={formData.tambon}
                    onChange={(e) => handleChange('tambon', e.target.value)}
                    style={{ ...styles.input, backgroundColor: '#ffffff', cursor: 'pointer' }}
                  >
                    {tambonList.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1, ...styles.fieldGroup }}>
                  <label style={styles.label}>🏡 หมู่ที่</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.moo}
                    onChange={(e) => handleChange('moo', e.target.value)}
                    required
                    style={{ ...styles.input, textAlign: 'center' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1, ...styles.fieldGroup }}>
                  <label style={styles.label}>⚖️ น้ำหนัก (กก.)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.weight}
                    onChange={(e) => handleChange('weight', e.target.value)}
                    placeholder="60"
                    style={styles.input}
                  />
                </div>
                <div style={{ flex: 1, ...styles.fieldGroup }}>
                  <label style={styles.label}>📏 ส่วนสูง (ซม.)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.height}
                    onChange={(e) => handleChange('height', e.target.value)}
                    placeholder="165"
                    style={styles.input}
                  />
                </div>
              </div>

              {/* 1. สภาวะฟัน */}
              <div style={styles.sectionCardPurple}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={styles.sectionTitlePurple}>🦷 1. ผลตรวจสภาวะฟัน</span>
                  <span style={{ fontSize: '11px', color: '#6d28d9', fontWeight: 'bold' }}>⚡ เลือกด่วน:</span>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => handleQuickPreset('full28')} style={styles.presetBtn}>ครบ 28 ซี่</button>
                  <button type="button" onClick={() => handleQuickPreset('full32')} style={styles.presetBtn}>ครบ 32 ซี่</button>
                  <button type="button" onClick={() => handleQuickPreset('none')} style={styles.presetBtnDanger}>ไม่มีฟันเลย</button>
                </div>

                <CounterRow icon="✨" label="ฟันแท้ (ซี่)" value={formData.total_teeth} onMinus={() => handleCounter('total_teeth', -1)} onPlus={() => handleCounter('total_teeth', 1)} isHighlight={true} />
                <CounterRow icon="😬" label="คู่สบฟันหลัง (คู่)" value={formData.posterior_occlusion} onMinus={() => handleCounter('posterior_occlusion', -1)} onPlus={() => handleCounter('posterior_occlusion', 1)} />
                <CounterRow icon="🛠" label="อุดแล้ว (ซี่)" value={formData.filled_teeth} onMinus={() => handleCounter('filled_teeth', -1)} onPlus={() => handleCounter('filled_teeth', 1)} />
                <CounterRow icon="❌" label="ถอนแล้ว (ซี่)" value={formData.extracted_teeth} onMinus={() => handleCounter('extracted_teeth', -1)} onPlus={() => handleCounter('extracted_teeth', 1)} />
              </div>

              {/* 2. ปริทันต์ */}
              <div style={styles.sectionCardGreen}>
                <span style={styles.sectionTitleGreen}>🩸 2. สภาวะปริทันต์</span>
                <div style={{ display: 'flex', gap: '12px', margin: '2px 0' }}>
                  <label style={styles.radioRow}>
                    <input type="radio" name="periodontal_status" value="ปกติ" checked={formData.periodontal_status === 'ปกติ'} onChange={(e) => handleChange('periodontal_status', e.target.value)} style={styles.radio} />
                    <span style={styles.checkboxLabel}>🌿 ปกติ</span>
                  </label>
                  <label style={styles.radioRow}>
                    <input type="radio" name="periodontal_status" value="เหงือกอักเสบ/มีหินปูน" checked={formData.periodontal_status === 'เหงือกอักเสบ/มีหินปูน'} onChange={(e) => handleChange('periodontal_status', e.target.value)} style={styles.radio} />
                    <span style={styles.checkboxLabel}>⚠️ เหงือกอักเสบ/หินปูน</span>
                  </label>
                </div>
                <div style={styles.subOptionBox}>
                  <span style={{ fontSize: '11px', color: '#047857', fontWeight: 'bold' }}>📌 สัญญาณเสี่ยง:</span>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                    <label style={styles.checkboxRow}>
                      <input type="checkbox" checked={formData.bleeding_on_brushing} onChange={(e) => handleChange('bleeding_on_brushing', e.target.checked)} style={{ ...styles.checkbox, accentColor: '#059669' }} />
                      <span style={{ fontSize: '12.5px', color: '#374151' }}>🩸 เลือดออกขณะแปรง</span>
                    </label>
                    <label style={styles.checkboxRow}>
                      <input type="checkbox" checked={formData.has_calculus} onChange={(e) => handleChange('has_calculus', e.target.checked)} style={{ ...styles.checkbox, accentColor: '#059669' }} />
                      <span style={{ fontSize: '12.5px', color: '#374151' }}>🦴 มีหินปูน</span>
                    </label>
                  </div>
                </div>
                <CounterRow icon="〰️" label="ฟันโยก (ซี่)" value={formData.mobile_teeth} onMinus={() => handleCounter('mobile_teeth', -1)} onPlus={() => handleCounter('mobile_teeth', 1)} />
              </div>

              {/* 3. รักษาที่จำเป็น */}
              <div style={styles.sectionCardPurple}>
                <span style={styles.sectionTitlePurple}>💊 3. การรักษาที่จำเป็น</span>
                <label style={styles.checkboxRow}>
                  <input type="checkbox" checked={formData.need_fluoride} onChange={(e) => handleChange('need_fluoride', e.target.checked)} style={styles.checkbox} />
                  <span style={styles.checkboxLabel}>🛡️ เคลือบ/ทาฟลูออไรด์</span>
                </label>
                <label style={styles.checkboxRow}>
                  <input type="checkbox" checked={formData.need_scaling} onChange={(e) => handleChange('need_scaling', e.target.checked)} style={styles.checkbox} />
                  <span style={styles.checkboxLabel}>🧼 ขูดหินปูน</span>
                </label>
                <CounterRow icon="🩹" label="จำเป็นต้องอุด (ซี่)" value={formData.need_fill_count} onMinus={() => handleCounter('need_fill_count', -1)} onPlus={() => handleCounter('need_fill_count', 1)} />
                <CounterRow icon="🚨" label="จำเป็นต้องถอน (ซี่)" value={formData.need_ext_count} onMinus={() => handleCounter('need_ext_count', -1)} onPlus={() => handleCounter('need_ext_count', 1)} />
              </div>

              {/* 4. ฟันปลอม */}
              <div style={styles.sectionCardGreen}>
                <span style={styles.sectionTitleGreen}>😁 4. ความต้องการฟันปลอม</span>
                <select value={formData.denture_need} onChange={(e) => handleChange('denture_need', e.target.value)} style={styles.select}>
                  <option value="ไม่ต้องใส่">ไม่ต้องใส่ 🟢</option>
                  <option value="ฟันปลอมบางส่วน">ต้องการฟันปลอมบางส่วน 🟡</option>
                  <option value="ฟันปลอมทั้งปาก">ต้องการฟันปลอมทั้งปาก 🟠</option>
                </select>
              </div>

              {/* 5. รอยโรค */}
              <div style={styles.sectionCardRose}>
                <span style={styles.sectionTitleRose}>🔍 5. คัดกรองรอยโรคในช่องปาก</span>
                <label style={styles.checkboxRow}>
                  <input type="checkbox" checked={formData.lesion_normal} onChange={(e) => handleLesionChange('lesion_normal', e.target.checked)} style={{ ...styles.checkbox, accentColor: '#16a34a' }} />
                  <span style={{ ...styles.checkboxLabel, fontWeight: 'bold', color: '#15803d' }}>✅ ปกติ (ไม่พบรอยโรค)</span>
                </label>
                <hr style={{ border: 'none', borderTop: '1px dashed #fecdd3', margin: '4px 0' }} />
                <label style={styles.checkboxRow}>
                  <input type="checkbox" checked={formData.lesion_red} onChange={(e) => handleLesionChange('lesion_red', e.target.checked)} style={styles.checkbox} />
                  <span style={styles.checkboxLabel}>🔴 พบรอยโรคสีแดง</span>
                </label>
                <label style={styles.checkboxRow}>
                  <input type="checkbox" checked={formData.lesion_white} onChange={(e) => handleLesionChange('lesion_white', e.target.checked)} style={styles.checkbox} />
                  <span style={styles.checkboxLabel}>⚪ พบรอยโรคสีขาว</span>
                </label>
                <label style={styles.checkboxRow}>
                  <input type="checkbox" checked={formData.lesion_mass} onChange={(e) => handleLesionChange('lesion_mass', e.target.checked)} style={styles.checkbox} />
                  <span style={styles.checkboxLabel}>🟣 มีก้อน หรือ ไตแข็ง</span>
                </label>
                <label style={styles.checkboxRow}>
                  <input type="checkbox" checked={formData.lesion_ulcer} onChange={(e) => handleLesionChange('lesion_ulcer', e.target.checked)} style={styles.checkbox} />
                  <span style={styles.checkboxLabel}>⚠️ แผลไม่หายภายใน 2 สัปดาห์</span>
                </label>
              </div>

              {/* 6. ความเร่งด่วน */}
              <div style={styles.sectionCardPurple}>
                <span style={styles.sectionTitlePurple}>🏷️️ 6. สรุปผลคัดกรอง / ความเร่งด่วน</span>
                <select value={formData.triage_level} onChange={(e) => handleChange('triage_level', e.target.value)} style={styles.selectTriage}>
                  <option value="ปกติ (🟢)">🟢 ปกติ / ตรวจตามรอบ</option>
                  <option value="ปานกลาง (🟡)">🟡 ปานกลาง (มีฟันผุ/หินปูน)</option>
                  <option value="เร่งด่วน/ส่งต่อ (🔴)">🔴 เร่งด่วน / ส่งต่อพบทันตแพทย์ (พบรอยโรค/ปวดมาก)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button type="button" onClick={resetForm} style={styles.resetBtn}>🧹 ล้างแบบฟอร์ม</button>
                <button type="submit" disabled={loading} style={{ ...styles.submitBtn, opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'กำลังบันทึก...' : (editingId ? '💾 บันทึกการแก้ไข' : '💾 บันทึกข้อมูล')}
                </button>
              </div>
            </form>
          </>
        )}

        {/* ==================== 2. Dashboard สรุปสถิติ ==================== */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ textAlign: 'center', marginBottom: '2px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#5b21b6', margin: '0 0 2px 0' }}>📊 สรุปสถิติทันตสุขภาพชุมชน</h2>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>ยอดตรวจสะสม: <strong>{totalCount}</strong> รายการ</span>
            </div>

            <div style={styles.filterCard}>
              <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#4c1d95' }}>🔍 กรองดูข้อมูลตามตำบล:</label>
              <select value={selectedDashboardTambon} onChange={(e) => setSelectedDashboardTambon(e.target.value)} style={styles.filterSelect}>
                <option value="ทั้งหมด">🌐 ทุกตำบล (ภาพรวมอำเภอ)</option>
                {tambonList.map((t) => (
                  <option key={t} value={t}>📍 {t}</option>
                ))}
              </select>
            </div>

            <div style={styles.dashboardGrid}>
              <div style={{ ...styles.dashCard, backgroundColor: '#f3e8ff', borderColor: '#ddd6fe' }}>
                <span style={{ fontSize: '20px' }}>👥</span>
                <span style={{ ...styles.dashNum, color: '#6d28d9' }}>{totalCount}</span>
                <span style={styles.dashLabel}>ผู้รับการตรวจ</span>
              </div>
              <div style={{ ...styles.dashCard, backgroundColor: '#fef2f2', borderColor: '#fecdd3' }}>
                <span style={{ fontSize: '20px' }}>🚨</span>
                <span style={{ ...styles.dashNum, color: '#dc2626' }}>{urgentTriageCount}</span>
                <span style={styles.dashLabel}>ส่งต่อเร่งด่วน (🔴)</span>
              </div>
              <div style={{ ...styles.dashCard, backgroundColor: '#fff7ed', borderColor: '#ffedd5' }}>
                <span style={{ fontSize: '20px' }}>🦷</span>
                <span style={{ ...styles.dashNum, color: '#c2410c' }}>{denturePartialCount + dentureFullCount}</span>
                <span style={styles.dashLabel}>ต้องการฟันปลอม</span>
              </div>
              <div style={{ ...styles.dashCard, backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }}>
                <span style={{ fontSize: '20px' }}>🩸</span>
                <span style={{ ...styles.dashNum, color: '#047857' }}>{bopCount}</span>
                <span style={styles.dashLabel}>เลือดออกขณะแปรง</span>
              </div>
            </div>

            {selectedDashboardTambon === 'ทั้งหมด' && (
              <div style={styles.dashSection}>
                <h3 style={styles.dashSectionTitle}>🏘️ สัดส่วนผู้ตรวจแยกตามตำบล</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {tambonList.map((t) => {
                    const countInTambon = rawCombinedData.filter((i) => i.tambon === t).length;
                    return <ProgressBar key={t} label={t} count={countInTambon} total={rawCombinedData.length} color="#6d28d9" />;
                  })}
                </div>
              </div>
            )}

            <div style={styles.dashSection}>
              <h3 style={styles.dashSectionTitle}>🩸 สภาวะปริทันต์ & ความเสี่ยง</h3>
              <ProgressBar label="มีหินปูน (Calculus)" count={calculusCount} total={totalCount} color="#059669" />
              <ProgressBar label="เลือดออกขณะแปรง (BOP)" count={bopCount} total={totalCount} color="#0284c7" />
              <ProgressBar label="ต้องการขูดหินปูน" count={needScalingCount} total={totalCount} color="#7c3aed" />
            </div>

            <div style={styles.dashSection}>
              <h3 style={styles.dashSectionTitle}>😁 สรุปความต้องการฟันปลอม</h3>
              <ProgressBar label="ต้องการฟันปลอมบางส่วน" count={denturePartialCount} total={totalCount} color="#d97706" />
              <ProgressBar label="ต้องการฟันปลอมทั้งปาก" count={dentureFullCount} total={totalCount} color="#dc2626" />
              <ProgressBar label="ต้องการเคลือบฟลูออไรด์ (F)" count={needFluorideCount} total={totalCount} color="#16a34a" />
            </div>

            <div style={{ ...styles.dashSection, borderLeft: '4px solid #be123c' }}>
              <h3 style={{ ...styles.dashSectionTitle, color: '#be123c' }}>🔍 สรุปการพบรอยโรคในช่องปาก</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <StatRow label="🔴 รอยโรคสีแดง" value={lesionRedCount} color="#be123c" />
                <StatRow label="⚪ รอยโรคสีขาว" value={lesionWhiteCount} color="#4b5563" />
                <StatRow label="🟣 มีก้อน หรือ ไตแข็ง" value={lesionMassCount} color="#6d28d9" />
                <StatRow label="⚠️ แผลไม่หายใน 2 สัปดาห์" value={lesionUlcerCount} color="#d97706" />
              </div>
            </div>
          </div>
        )}

        {/* ==================== 3. ค้นหาและแก้ไขประวัติ ==================== */}
        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#5b21b6', margin: '0 0 2px 0' }}>🔍 ค้นหาและแก้ไขประวัติ</h2>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>ค้นหาด้วยชื่อ, เลขบัตรประชาชน หรือตำบล</span>
            </div>

            <div style={styles.fieldGroup}>
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="พิมพ์ค้นหา (เช่น สมชาย หรือ 13 หลัก)..." style={styles.searchInput} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
              {filteredHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af', fontSize: '13.5px' }}>ไม่พบประวัติการตรวจในระบบ</div>
              ) : (
                filteredHistory.map((item, idx) => (
                  <div key={item.id || item._offline_id || idx} style={styles.historyCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#4c1d95' }}>
                          {item.fullname} <span style={{ fontSize: '11px', color: '#6b7280' }}>(อายุ {item.age || '-'} ปี)</span>
                        </span>
                        <div style={{ fontSize: '11.5px', color: '#374151', marginTop: '2px' }}>
                          🆔 CID: {item.cid} | 📍 {item.tambon} ม.{item.moo}
                        </div>
                        <div style={{ fontSize: '11px', color: '#059669', fontWeight: '600', marginTop: '2px' }}>
                          🏷️ ผลประเมิน: {item.triage_level || 'ปกติ'} | ฟันแท้: {item.total_teeth} ซี่
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button type="button" onClick={() => handleEditRecord(item)} style={styles.editBtn}>✏️ แก้ไข</button>
                          <button type="button" onClick={() => handleDeleteRecord(item)} style={styles.delBtn}>🗑️ ลบ</button>
                        </div>
                        <button type="button" onClick={() => setPrintData(item)} style={styles.printSlipBtn}>🖨️ พิมพ์สลิป</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div style={styles.divider} />

        <button type="button" onClick={() => setShowExportModal(true)} style={styles.exportBtn}>
          🔒 ส่งออกไฟล์ CSV (ต้องยืนยันรหัสผ่าน)
        </button>

        <footer style={styles.footerCredit}>
          <span>Designed & Developed with 💜 by</span>
          <strong style={{ color: '#6d28d9', fontSize: '12px' }}>Saranrak Kampirom</strong>
        </footer>
      </div>

      {/* ==================== Modal ใบสรุปผลคัดกรอง (Print Slip) ==================== */}
      {printData && (
        <div style={styles.modalOverlay}>
          <div style={styles.slipCard}>
            <div style={{ textAlign: 'center', borderBottom: '2px dashed #7c3aed', paddingBottom: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '24px' }}>🦷</span>
              <h3 style={{ margin: '2px 0', color: '#4c1d95', fontSize: '16px' }}>ใบสรุปผลการคัดกรองสุขภาพช่องปาก</h3>
              <span style={{ fontSize: '11px', color: '#6b7280' }}>DentiScan Pro - อำเภอสมเด็จ จ.กาฬสินธุ์</span>
            </div>

            <div style={{ fontSize: '12.5px', color: '#374151', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
              <div>👤 <strong>ชื่อ-สกุล:</strong> {printData.fullname} (อายุ {printData.age || '-'} ปี)</div>
              <div>🆔 <strong>CID:</strong> {printData.cid}</div>
              <div>📍 <strong>ที่อยู่:</strong> {printData.tambon} หมู่ {printData.moo}</div>
              <div>📅 <strong>วันที่ตรวจ:</strong> {new Date(printData.created_at || Date.now()).toLocaleDateString('th-TH')}</div>
              <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />
              <div>🦷 <strong>ฟันแท้:</strong> {printData.total_teeth} ซี่ | อุดแล้ว: {printData.filled_teeth} ซี่ | ถอนแล้ว: {printData.extracted_teeth} ซี่</div>
              <div>🩸 <strong>สภาวะปริทันต์:</strong> {printData.periodontal_status} {printData.has_calculus ? '(มีหินปูน)' : ''} {printData.bleeding_on_brushing ? '(เลือดออกขณะแปรง)' : ''}</div>
              <div>😁 <strong>ความต้องการฟันปลอม:</strong> {printData.denture_need}</div>
              <div style={{ backgroundColor: printData.triage_level?.includes('เร่งด่วน') ? '#ffeeec' : '#f0fdf4', padding: '6px', borderRadius: '8px', marginTop: '4px' }}>
                🏷️ <strong>ผลประเมิน / ความเร่งด่วน:</strong> <span style={{ fontWeight: '700', color: printData.triage_level?.includes('เร่งด่วน') ? '#dc2626' : '#047857' }}>{printData.triage_level}</span>
              </div>
              <div style={{ marginTop: '4px', fontSize: '12px', color: '#5b21b6', fontWeight: '600' }}>
                💡 <strong>คำแนะนำจากเจ้าหน้าที่:</strong> {printData.need_scaling ? '• แนะนำขูดหินปูน ' : ''} {printData.need_fluoride ? '• ทาฟลูออไรด์ ' : ''} {printData.need_fill_count > 0 ? `• อุดฟัน ${printData.need_fill_count} ซี่` : ''} {!printData.need_scaling && !printData.need_fluoride && printData.need_fill_count === 0 ? '• สุขภาพช่องปากปกติดี รักษาความสะอาดสม่ำเสมอ' : ''}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'right', marginTop: '6px' }}>
                🩺 ผู้ตรวจ: {printData.examiner_name || '-'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setPrintData(null)} style={styles.cancelBtn}>ปิดหน้าต่าง</button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                style={styles.confirmExportBtn}
              >
                🖨️ พิมพ์เอกสาร
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ยืนยันสิทธิ์ส่งออก CSV */}
      {showExportModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={{ textAlign: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '28px' }}>🔐</span>
              <h3 style={{ margin: '4px 0 0 0', color: '#5b21b6', fontSize: '18px' }}>ยืนยันสิทธิ์การส่งออกข้อมูล</h3>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>ข้อมูลผู้ป่วยเป็นข้อมูลส่วนบุคคล กรุณากรอกรหัสผ่านเพื่อส่งออก</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>👩‍💼 ชื่อเจ้าหน้าที่ผู้ส่งออก <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="text" value={exporterName} onChange={(e) => setExporterName(e.target.value)} placeholder="ระบุชื่อผู้ทำรายการส่งออก" style={styles.input} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>🔑 รหัสยืนยันความปลอดภัย <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="กรอกรหัสผ่าน (เช่น 1234)" style={{ ...styles.input, letterSpacing: '2px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
              <button type="button" onClick={() => { setShowExportModal(false); setPasscode(''); }} style={styles.cancelBtn}>ยกเลิก</button>
              <button type="button" onClick={handleConfirmExport} style={styles.confirmExportBtn}>ดาวน์โหลด CSV</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ label, count, total, color }: any) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', color: '#374151' }}>
        <span>{label}</span>
        <span>{count} ราย ({percent}%)</span>
      </div>
      <div style={{ width: '100%', height: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${percent}%`, height: '100%', backgroundColor: color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

function StatRow({ label, value, color }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px dashed #f3f4f6' }}>
      <span style={{ fontSize: '12.5px', color: '#374151', fontWeight: '500' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: '700', color: color }}>{value} ราย</span>
    </div>
  );
}

function CounterRow({ icon, label, value, onMinus, onPlus, isHighlight = false }: any) {
  return (
    <div style={isHighlight ? styles.totalTeethRow : styles.counterRow}>
      <span style={{ fontSize: '13.5px', fontWeight: isHighlight ? '700' : '500', color: isHighlight ? '#5b21b6' : '#374151' }}>
        {icon} {label}
      </span>
      <div style={styles.counterControl}>
        <button type="button" onClick={onMinus} style={styles.counterBtnMinus}>-</button>
        <span style={styles.counterNum}>{value}</span>
        <button type="button" onClick={onPlus} style={isHighlight ? styles.counterBtnPlusPrimary : styles.counterBtnPlus}>+</button>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  bgContainer: {
    minHeight: '100vh',
    backgroundColor: '#f5f3ff',
    backgroundImage: 'linear-gradient(135deg, #f3e8ff 0%, #ecfdf5 100%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px 12px',
    fontFamily: "'Kanit', -apple-system, BlinkMacSystemFont, sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundWatermark: {
    position: 'absolute',
    bottom: '15px',
    right: '20px',
    fontSize: '11px',
    fontWeight: '700',
    color: 'rgba(124, 58, 237, 0.15)',
    letterSpacing: '1.5px',
    pointerEvents: 'none',
    userSelect: 'none',
    textTransform: 'uppercase',
  },
  card: {
    width: '100%',
    maxWidth: '460px',
    backgroundColor: '#ffffff',
    borderRadius: '28px',
    boxShadow: '0 20px 30px -10px rgba(124, 58, 237, 0.12), 0 10px 15px -5px rgba(5, 150, 105, 0.08)',
    padding: '20px 20px 18px 20px',
    boxSizing: 'border-box',
    border: '1px solid #f3e8ff',
    position: 'relative',
    zIndex: 1,
  },
  networkBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 12px',
    borderRadius: '12px',
    border: '1px solid',
    marginBottom: '10px',
  },
  badgeCount: {
    fontSize: '10.5px',
    backgroundColor: '#ffedd5',
    color: '#c2410c',
    padding: '2px 8px',
    borderRadius: '8px',
    fontWeight: '700',
  },
  syncBtn: {
    fontSize: '10.5px',
    backgroundColor: '#059669',
    color: '#ffffff',
    border: 'none',
    padding: '3px 8px',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  header: { textAlign: 'center', marginBottom: '10px' },
  iconCircle: {
    width: '52px',
    height: '52px',
    backgroundColor: '#f3e8ff',
    borderRadius: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    margin: '0 auto 8px auto',
  },
  title: { fontSize: '22px', fontWeight: '800', color: '#4c1d95', margin: '0 0 2px 0' },
  subtitle: { fontSize: '12.5px', color: '#059669', margin: 0, fontWeight: '500' },
  tabContainer3: {
    display: 'flex',
    backgroundColor: '#f3f4f6',
    borderRadius: '14px',
    padding: '4px',
    marginBottom: '14px',
    gap: '4px',
  },
  activeTabBtn: {
    flex: 1,
    padding: '8px 4px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#ffffff',
    color: '#6d28d9',
    fontWeight: '700',
    fontSize: '12px',
    textAlign: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
    cursor: 'pointer',
  },
  inactiveTabBtn: {
    flex: 1,
    padding: '8px 4px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#6b7280',
    fontWeight: '500',
    fontSize: '12px',
    textAlign: 'center',
    cursor: 'pointer',
  },
  scanBtn: {
    fontSize: '11px',
    backgroundColor: '#ede9fe',
    color: '#6d28d9',
    border: '1px solid #c4b5fd',
    padding: '3px 8px',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  printPromptCard: {
    backgroundColor: '#f5f3ff',
    border: '1.5px solid #c4b5fd',
    borderRadius: '14px',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '14px',
    fontSize: '12.5px',
    fontWeight: '600',
    color: '#5b21b6',
    textAlign: 'center',
  },
  skipPrintBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    color: '#6b7280',
    border: '1px solid #d1d5db',
    padding: '6px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  nowPrintBtn: {
    flex: 2,
    backgroundColor: '#7c3aed',
    color: '#ffffff',
    border: 'none',
    padding: '6px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
  },
  editingBanner: {
    backgroundColor: '#fff7ed',
    border: '1px solid #ffedd5',
    color: '#c2410c',
    padding: '8px 12px',
    borderRadius: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    fontWeight: '600',
    marginBottom: '10px',
  },
  cancelEditBtn: {
    backgroundColor: '#ea580c',
    color: '#ffffff',
    border: 'none',
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  searchInput: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '12px',
    border: '1.5px solid #c4b5fd',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: '#faf5ff',
    boxSizing: 'border-box',
    color: '#5b21b6',
  },
  historyCard: {
    backgroundColor: '#fafafa',
    border: '1px solid #e5e7eb',
    borderRadius: '14px',
    padding: '10px 12px',
  },
  editBtn: {
    backgroundColor: '#ede9fe',
    color: '#6d28d9',
    border: '1px solid #ddd6fe',
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  delBtn: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    border: '1px solid #fecdd3',
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  printSlipBtn: {
    backgroundColor: '#ecfdf5',
    color: '#047857',
    border: '1px solid #a7f3d0',
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '2px',
  },
  filterCard: {
    backgroundColor: '#faf5ff',
    border: '1.5px solid #ddd6fe',
    borderRadius: '14px',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  filterSelect: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '10px',
    border: '1.5px solid #c4b5fd',
    fontSize: '13.5px',
    fontWeight: '600',
    color: '#5b21b6',
    backgroundColor: '#ffffff',
    outline: 'none',
    cursor: 'pointer',
  },
  dashboardGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  dashCard: {
    padding: '10px',
    borderRadius: '14px',
    border: '1px solid',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  dashNum: { fontSize: '20px', fontWeight: '800', margin: '2px 0' },
  dashLabel: { fontSize: '11px', color: '#4b5563', fontWeight: '500' },
  dashSection: {
    backgroundColor: '#fafafa',
    border: '1px solid #f3f4f6',
    borderRadius: '14px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  dashSectionTitle: { fontSize: '13px', fontWeight: '700', color: '#4c1d95', margin: '0 0 2px 0' },
  statsBar: {
    display: 'flex',
    backgroundColor: '#f5f3ff',
    borderRadius: '16px',
    padding: '10px',
    marginBottom: '16px',
    border: '1px solid #ddd6fe',
    alignItems: 'center',
  },
  statBox: { flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column' },
  statNumber: { fontSize: '20px', fontWeight: '800', color: '#6d28d9', lineHeight: '1.2' },
  statLabel: { fontSize: '11px', color: '#6b7280', fontWeight: '500' },
  statDivider: { width: '1px', backgroundColor: '#ddd6fe', height: '28px' },
  alertBox: {
    backgroundColor: '#f3e8ff',
    color: '#6d28d9',
    padding: '12px',
    borderRadius: '14px',
    marginBottom: '16px',
    fontSize: '13.5px',
    fontWeight: '600',
    textAlign: 'center',
    border: '1.5px solid #ddd6fe',
  },
  duplicateWarningBox: {
    backgroundColor: '#fff7ed',
    border: '1px solid #ffedd5',
    color: '#c2410c',
    padding: '6px 10px',
    borderRadius: '8px',
    fontSize: '11.5px',
    fontWeight: '600',
  },
  examinerCard: {
    backgroundColor: '#f5f3ff',
    border: '1.5px solid #ddd6fe',
    borderRadius: '16px',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  examinerLabel: { fontSize: '13px', fontWeight: '700', color: '#5b21b6' },
  examinerInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1.5px solid #c4b5fd',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#ffffff',
    color: '#4c1d95',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '12.5px', fontWeight: '600', color: '#374151' },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1.5px solid #e5e7eb',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#fafafa',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1.5px solid #a7f3d0',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#ffffff',
    color: '#065f46',
    fontWeight: '500',
  },
  selectTriage: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1.5px solid #c4b5fd',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#ffffff',
    color: '#4c1d95',
    fontWeight: '600',
  },
  sectionCardPurple: {
    backgroundColor: '#faf5ff',
    border: '1.5px solid #f3e8ff',
    borderRadius: '16px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sectionTitlePurple: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#6d28d9',
    borderBottom: '1px dashed #e9d5ff',
    paddingBottom: '6px',
  },
  presetBtn: {
    flex: 1,
    padding: '6px 4px',
    borderRadius: '8px',
    border: '1px solid #c4b5fd',
    backgroundColor: '#ffffff',
    color: '#6d28d9',
    fontSize: '11.5px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  presetBtnDanger: {
    flex: 1,
    padding: '6px 4px',
    borderRadius: '8px',
    border: '1px solid #fca5a5',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    fontSize: '11.5px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  sectionCardGreen: {
    backgroundColor: '#f0fdf4',
    border: '1.5px solid #d1fae5',
    borderRadius: '16px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sectionTitleGreen: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#047857',
    borderBottom: '1px dashed #a7f3d0',
    paddingBottom: '6px',
  },
  subOptionBox: {
    backgroundColor: '#ffffff',
    padding: '8px 10px',
    borderRadius: '12px',
    border: '1px dashed #a7f3d0',
    display: 'flex',
    flexDirection: 'column',
  },
  sectionCardRose: {
    backgroundColor: '#fff1f2',
    border: '1.5px solid #ffe4e6',
    borderRadius: '16px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sectionTitleRose: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#be123c',
    borderBottom: '1px dashed #fecdd3',
    paddingBottom: '6px',
  },
  totalTeethRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f3e8ff',
    padding: '8px 12px',
    borderRadius: '12px',
    border: '1px solid #ddd6fe',
  },
  counterRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: '6px 10px',
    borderRadius: '12px',
    border: '1px solid #f3f4f6',
  },
  counterControl: { display: 'flex', alignItems: 'center', gap: '6px' },
  counterBtnMinus: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
    color: '#6b7280',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  counterBtnPlus: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#d1fae5',
    color: '#047857',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  counterBtnPlusPrimary: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#7c3aed',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  counterNum: { width: '28px', textAlign: 'center', fontWeight: '700', fontSize: '15px' },
  checkboxRow: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '3px 0' },
  radioRow: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' },
  checkbox: { width: '18px', height: '18px', accentColor: '#7c3aed', cursor: 'pointer' },
  radio: { width: '16px', height: '16px', accentColor: '#059669', cursor: 'pointer' },
  checkboxLabel: { fontSize: '13.5px', color: '#374151' },
  submitBtn: {
    flex: 2,
    backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
    color: '#ffffff',
    padding: '14px',
    borderRadius: '16px',
    border: 'none',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(124, 58, 237, 0.28)',
  },
  resetBtn: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    color: '#4b5563',
    padding: '14px',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  divider: { height: '1px', backgroundColor: '#f3e8ff', margin: '18px 0 14px 0' },
  exportBtn: {
    width: '100%',
    backgroundImage: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
    color: '#ffffff',
    padding: '12px',
    borderRadius: '16px',
    border: 'none',
    fontSize: '14.5px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(5, 150, 105, 0.22)',
  },
  footerCredit: {
    marginTop: '16px',
    textAlign: 'center',
    fontSize: '11px',
    color: '#9ca3af',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(76, 29, 149, 0.35)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '16px',
    zIndex: 1000,
  },
  slipCard: {
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    padding: '20px',
    width: '100%',
    maxWidth: '360px',
    boxShadow: '0 20px 30px rgba(0,0,0,0.2)',
    border: '2px solid #7c3aed',
  },
  cancelBtn: {
    flex: 1,
    padding: '10px',
    borderRadius: '12px',
    border: '1.5px solid #e5e7eb',
    backgroundColor: '#ffffff',
    color: '#6b7280',
    fontWeight: '600',
    cursor: 'pointer',
  },
  confirmExportBtn: {
    flex: 1,
    padding: '10px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#7c3aed',
    color: '#ffffff',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)',
  },
};