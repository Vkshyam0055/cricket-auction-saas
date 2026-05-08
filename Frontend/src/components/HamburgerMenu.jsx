import React from 'react';

export default function HamburgerMenu({ open, onClose, profile, onNavigate, onLogout }) {
  const items = [
    'Create Auction','My Auction','Pricing','Join as Player','View Auction','Reset Password','Support','About Us','Tutorial Videos','Policies'
  ];
  return <>
    <div className={`fixed inset-0 bg-black/40 transition-opacity z-40 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
    <aside className={`fixed top-0 left-0 h-full w-80 bg-white z-50 shadow-2xl transform transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-4 border-b"><div className="font-bold">{profile?.name}</div><div className="text-sm text-gray-500">{profile?.email || profile?.phone}</div></div>
      <div className="p-3 space-y-2">{items.map((item)=><button key={item} className="block w-full text-left px-3 py-2 rounded hover:bg-gray-100" onClick={()=>onNavigate(item)}>{item}</button>)}</div>
      <div className="p-3"><button className="w-full bg-red-500 text-white py-2 rounded" onClick={onLogout}>Logout</button></div>
    </aside>
  </>;
}