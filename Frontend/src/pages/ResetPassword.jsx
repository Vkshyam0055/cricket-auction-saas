import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/apiClient';

export default function ResetPassword() {
  const { token } = useParams();
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    await apiRequest({
      method: 'post',
      path: `/api/auth/reset-password/${token}`,
      data: { password, confirmPassword }
    });
    setMsg('Password reset हो गया।');
    setTimeout(() => nav('/auth'), 800);
  };

  return <div className="min-h-screen flex items-center justify-center"><form onSubmit={submit} className="bg-white p-6 rounded shadow w-96"><h2 className="text-xl font-bold mb-3">Reset Password</h2><input type="password" className="w-full border p-2 mb-3" value={password} onChange={e => setPassword(e.target.value)} placeholder="New password" required /><input type="password" className="w-full border p-2 mb-3" value={confirmPassword} onChange={e => setConfirm(e.target.value)} placeholder="Confirm password" required /><button className="w-full bg-blue-600 text-white p-2 rounded">Update Password</button><p className="mt-3 text-green-600">{msg}</p></form></div>;
}
