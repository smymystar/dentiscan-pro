import React, { useState } from 'react';

// กำหนดสีหลักของแบรนด์
const PRIMARY_COLOR = '#8b5cf6'; // สีม่วง

export default function App() {
  const [formData, setFormData] = useState({
    hn: '',
    name: '',
    age: '',
    screeningResult: 'ปกติ',
    DentView: ''
  });

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // ลิงก์ Google Apps Script Web App ของคุณ (อันเดิมที่ใช้งานได้)
  const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxllWTwnMq6FhUGhSALtgsnSFU_gLRApdgwJZlV2i9dRCAqeTLx5JMXQttAtlkI-BsU/exec";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage('');

    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      alert('✅ บันทึกข้อมูลสำเร็จ!');
      setStatusMessage('บันทึกข้อมูลเข้า Google Sheet เรียบร้อยแล้ว');
      
      setFormData({
        hn: '',
        name: '',
        age: '',
        screeningResult: 'ปกติ',
        DentView: ''
      });
    } catch (error) {
      console.error('Error saving data:', error);
      alert('❌ บันทึกไม่สำเร็จ: เกิดข้อผิดพลาดในการเชื่อมต่อ');
      setStatusMessage('บันทึกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = "mt-1 block w-full px-4 py-2.5 bg-purple-50 border border-purple-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-300 transition duration-200";
  const labelStyle = "block text-sm font-semibold text-gray-800";

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8 font-sans">
      <header className="flex items-center justify-between pb-6 border-b border-gray-200 mb-8">
        <div className='flex items-center gap-3'>
           <div className={`w-12 h-12 rounded-full bg-[${PRIMARY_COLOR}] flex items-center justify-center text-white font-bold text-2xl`}>🦷</div>
           <div>
             <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">DentiScan Pro</h1>
             <p className="text-gray-600">ระบบคัดกรองสุขภาพช่องปาก (Google Sheets Backend)</p>
           </div>
        </div>
        <div className={`flex items-center gap-2 bg-[${PRIMARY_COLOR}] text-white px-4 py-2 rounded-full font-medium text-sm`}>
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          ออนไลน์
        </div>
      </header>

      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <nav className="lg:col-span-1 space-y-3">
            <NavItem icon="📄" text="ฟอร์มตรวจ" active />
            <NavItem icon="📊" text="สถิติ" />
            <NavItem icon="⚙️" text="ตั้งค่า" />
             <div className='mt-6 p-6 bg-purple-100 rounded-3xl text-center border-2 border-purple-200 border-dashed'>
                <div className='text-6xl mb-2'>🦷</div>
                <p className='text-purple-900 font-bold'>เริ่มการคัดกรองใหม่</p>
                <p className='text-purple-700 text-sm'>บันทึกข้อมูลผู้รับบริการคนถัดไป</p>
             </div>
        </nav>

        <main className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
           <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">บันทึกผลการตรวจคัดกรอง</h2>
                <p className="text-gray-600">กรอกข้อมูลให้ครบถ้วนแล้วกดปุ่ม "บันทึกข้อมูลเข้า Google Sheet"</p>
           </div>

           <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="hn" className={labelStyle}>เลข HN <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        id="hn"
                        name="hn"
                        value={formData.hn}
                        onChange={handleChange}
                        required
                        className={inputStyle}
                        placeholder="ระบุเลข HN"
                      />
                    </div>

                    <div>
                      <label htmlFor="age" className={labelStyle}>อายุ (ปี) <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        id="age"
                        name="age"
                        value={formData.age}
                        onChange={handleChange}
                        required
                        min="0"
                        className={inputStyle}
                        placeholder="ระบุอายุ"
                      />
                    </div>
                </div>

                <div>
                  <label htmlFor="name" className={labelStyle}>ชื่อ - สกุล <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className={inputStyle}
                    placeholder="ชื่อผู้รับบริการ"
                  />
                </div>

                <div>
                  <label htmlFor="screeningResult" className={labelStyle}>ผลการคัดกรอง</label>
                  <select
                    id="screeningResult"
                    name="screeningResult"
                    value={formData.screeningResult}
                    onChange={handleChange}
                    className={`${inputStyle} appearance-none bg-no-repeat`}
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b21a8\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 0.75rem center', backgroundSize: '1.5rem 1.5rem' }}
                  >
                    <option value="ปกติ">ปกติ (ไม่ต้องใส่)</option>
                    <option value="ฟันผุต้องอุด">ฟันผุต้องอุด</option>
                    <option value="มีหินปูน/เหงือกอักเสบ">มีหินปูน/เหงือกอักเสบ</option>
                    <option value="เสี่ยงโรคในช่องปาก">เสี่ยงโรคในช่องปาก</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="DentView" className={labelStyle}>คำแนะนำเพิ่มเติม (DentView)</label>
                  <textarea
                    id="DentView"
                    name="DentView"
                    value={formData.DentView}
                    onChange={handleChange}
                    rows={3}
                    className={`${inputStyle} resize-none`}
                    placeholder="ระบุคำแนะนำสำหรับผู้รับบริการ..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full bg-[${PRIMARY_COLOR}] text-white py-4 rounded-2xl font-bold text-lg hover:bg-purple-700 transition duration-300 shadow-md hover:shadow-lg disabled:bg-gray-400 flex items-center justify-center gap-3`}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      กำลังบันทึกข้อมูลเข้า Google Sheet...
                    </>
                  ) : (
                    'บันทึกข้อมูลเข้า Google Sheet'
                  )}
                </button>
              </form>

              {statusMessage && (
                <p className={`mt-6 p-4 rounded-xl text-center font-medium text-purple-900 bg-purple-100 border border-purple-200 flex items-center justify-center gap-3`}>
                  <span className="w-4 h-4 rounded-full bg-green-400 inline-block animate-pulse"></span>
                  {statusMessage}
                </p>
              )}
        </main>
      </div>

      <footer className="mt-12 pt-6 border-t border-gray-200 text-center text-gray-600 text-sm">
        <p>© 2024 DentiScan Pro. พัฒนาด้วย React + Tailwind CSS เพื่อการคัดกรองสุขภาพช่องปากยุคใหม่.</p>
        <p>ระบบเชื่อมต่อกับ Google Sheet Backend ID: {GOOGLE_SCRIPT_URL.split('/')[5]}</p>
      </footer>
    </div>
  );
}

// คอมโพเนนต์ย่อยสำหรับเมนูนำทาง
function NavItem({ icon, text, active }: { icon: string; text: string; active?: boolean }) {
  return (
    <a href="#" className={`flex items-center gap-3.5 px-5 py-3.5 rounded-2xl text-lg font-semibold transition duration-300 ${active ? 'bg-purple-100 text-purple-900 shadow-sm' : 'text-gray-700 hover:bg-purple-50 hover:text-purple-700'}`}>
      <span className="text-2xl">{icon}</span>
      {text}
      {active && <span className="ml-auto w-3 h-3 rounded-full bg-[#8b5cf6]"></span>}
    </a>
  );
}
