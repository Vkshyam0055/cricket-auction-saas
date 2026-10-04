import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/apiClient';
import ImageCropperModal from '../components/ImageCropperModal';
import { uploadImageToCloudinary } from '../utils/cloudinaryUpload';

function ManagePlayers() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);

  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'APPROVED' | 'UNAPPROVED' | 'ICON' | 'SOLD' | 'UNSOLD'
  const [searchQuery, setSearchQuery] = useState('');

  const [isIconModalOpen, setIsIconModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [iconTeam, setIconTeam] = useState('');
  const [iconPrice, setIconPrice] = useState(0);

  const fileInputRef = useRef(null);
  const uploadSequenceRef = useRef(0);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoViewMode, setPhotoViewMode] = useState(false);

  const getTeamShortName = (teamRef) => {
    if (!teamRef) return '';
    if (typeof teamRef === 'object') {
      return teamRef.shortName || teamRef.teamName || '';
    }
    const match = teams.find((team) => String(team._id) === String(teamRef) || team.teamName === teamRef);
    return match?.shortName || match?.teamName || teamRef;
  };

  const getTeamFullName = (teamRef) => {
    if (!teamRef) return '';
    if (typeof teamRef === 'object') {
      return teamRef.teamName || '';
    }
    const match = teams.find((team) => String(team._id) === String(teamRef) || team.teamName === teamRef);
    return match?.teamName || teamRef;
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => setRawImageSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(e.target.files[0]);
      setCropperOpen(true);
    }
    e.target.value = null;
  };

  const uploadCroppedImage = async (blob) => {
    const sequenceId = ++uploadSequenceRef.current;
    setIsUploadingPhoto(true);
    try {
      const secureUrl = await uploadImageToCloudinary(blob, 'player-photo.jpg');
      if (sequenceId === uploadSequenceRef.current) {
        const token = localStorage.getItem('token');
        const res = await apiRequest({
          method: 'put',
          path: `/api/players/update-photo/${selectedPlayer._id}`,
          data: { photoUrl: secureUrl },
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data?.success) {
          setSelectedPlayer(res.data.player);
          fetchPlayers();
          alert('Photo updated successfully!');
        } else {
            alert(res.data?.message || 'Error updating photo');
        }
      }
    } catch (err) {
      console.error('Photo update error:', err);
      if (sequenceId === uploadSequenceRef.current) {
        const errorMsg =
          err?.response?.data?.message ||
          (err?.response?.status === 404 ? 'Server route not found. Please restart the backend server.' : '') ||
          err?.message ||
          'Failed to update photo.';
        alert(`❌ ${errorMsg}`);
      }
    } finally {
      if (sequenceId === uploadSequenceRef.current) {
        setIsUploadingPhoto(false);
      }
    }
  };

  const handleCropComplete = (croppedBlob) => {
    setCropperOpen(false);
    uploadCroppedImage(croppedBlob);
  };
  
  const handleDownloadPhoto = async () => {
    if (!selectedPlayer?.photoUrl) return;
    try {
      const response = await fetch(selectedPlayer.photoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `${selectedPlayer.name.replace(/[^a-zA-Z0-9]/g, '_')}_photo.jpg`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading photo:", error);
      alert("Failed to download photo.");
    }
  };



  const fetchPlayers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiRequest({
        method: 'get',
        path: '/api/players',
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlayers(response.data);
    } catch (error) { console.error(error); }
  };

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiRequest({
        method: 'get',
        path: '/api/teams',
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeams(response.data);
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    const initialize = async () => {
      await Promise.all([fetchPlayers(), fetchTeams()]);
    };
    initialize();
  }, []);

  const handleApproval = async (id, status) => {
    try {
      const token = localStorage.getItem('token');
      await apiRequest({
        method: 'put',
        path: `/api/players/approval/${id}`,
        data: { status },
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPlayers();
    } catch { alert('Error changing status'); }
  };

  const handlePriceUpdate = async (id, newPrice) => {
    try {
      const token = localStorage.getItem('token');
      await apiRequest({
        method: 'put',
        path: `/api/players/update-price/${id}`,
        data: { basePrice: newPrice },
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch { alert('Error updating price'); }
  };

  const handleCategoryUpdate = async (id, newCategory) => {
    try {
      const token = localStorage.getItem('token');
      await apiRequest({
        method: 'put',
        path: `/api/players/update-category/${id}`,
        data: { category: newCategory },
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlayers(prev =>
        prev.map(player => (player._id === id ? { ...player, category: newCategory } : player))
      );
    } catch {
      alert('Error updating category');
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`क्या आप सच में '${name}' को डिलीट करना चाहते हैं?`)) {
      try {
        const token = localStorage.getItem('token');
        await apiRequest({
          method: 'delete',
          path: `/api/players/${id}`,
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchPlayers();
      } catch { alert('Delete failed'); }
    }
  };

  const openIconModal = (player) => {
    setSelectedPlayer(player);
    setIconTeam('');
    setIconPrice(player.basePrice);
    setIsIconModalOpen(true);
  };

  const openDetailsModal = (player) => {
    setSelectedPlayer(player);
    setIsDetailsModalOpen(true);
  };

  const handleMakeIconSubmit = async (e) => {
    e.preventDefault();
    if (!iconTeam) { alert('Please select a team!'); return; }
    if (selectedIconTeamData && Number(iconPrice) > Number(selectedIconTeamData.maxBid || 0)) {
      alert(`🚫 Icon price blocked. ${getTeamFullName(iconTeam)} max bid is ₹${Number(selectedIconTeamData.maxBid || 0).toLocaleString()}`);
      return;
    }    
    try {
      const token = localStorage.getItem('token');
      await apiRequest({
        method: 'put',
        path: `/api/players/make-icon/${selectedPlayer._id}`,
        data: { teamId: iconTeam, iconPrice },
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`⭐ ${selectedPlayer.name} is now an ICON player for ${getTeamFullName(iconTeam)}!`);
      setIsIconModalOpen(false);
      fetchPlayers();
    } catch { alert('Failed to assign Icon player.'); }
  };

  const handleRemoveIcon = async (player) => {
    const confirmRemove = window.confirm(`क्या आप ${player.name} को ICON से हटाना चाहते हैं?`);
    if (!confirmRemove) return;

    try {
      const token = localStorage.getItem('token');
      const response = await apiRequest({
        method: 'put',
        path: `/api/players/remove-icon/${player._id}`,
        data: {},
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'ICON remove नहीं हो पाया।');
      }
      alert(`✅ ${response.data.message}`);
      fetchPlayers();
    } catch (error) {
      alert(error.response?.data?.message || error.message || 'ICON remove नहीं हो पाया।');
    }
  };

  const getSourceLabel = (source) => {
    if (source === 'Organizer') return 'Added by Organizer';
    return 'Public Registration';
  };

  const renderCustomData = (customData) => {
    if (!customData || Object.keys(customData).length === 0) {
      return <p className="text-sm text-gray-500">No additional custom fields.</p>;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(customData).map(([key, value]) => (
          <div key={key} className="bg-gray-50 border rounded-lg p-3">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">{key}</p>
            {typeof value === 'boolean' ? (
              <p className="font-bold text-gray-800">{value ? 'Yes' : 'No'}</p>
            ) : typeof value === 'string' && value.startsWith('http') ? (
              <a href={value} target="_blank" rel="noreferrer" className="text-blue-600 font-bold underline break-all">View File</a>
            ) : (
              <p className="font-bold text-gray-800 break-words">{value || '-'}</p>
            )}
          </div>
        ))}
      </div>
    );
  };

  const selectedIconTeamData = teams.find((team) => String(team._id) === String(iconTeam) || team.teamName === iconTeam);

  const renderApprovalStatusPill = (status) => {
    if (status === 'Approved') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
          ✓ Approved
        </span>
      );
    }
    if (status === 'Rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
          ✕ Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
        ⏳ Pending
      </span>
    );
  };

  const renderAuctionStatusPill = (status, soldTo) => {
    if (status === 'Sold') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
          Sold {soldTo && soldTo !== 'Unsold' ? `(${getTeamShortName(soldTo)})` : ''}
        </span>
      );
    }
    if (status === 'ReadyForAuction' || status === 'Ready') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          Ready For Auction
        </span>
      );
    }
    if (status === 'Unsold') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
          Unsold
        </span>
      );
    }
    if (status === 'InAuction') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
          ⚡ In Bidding
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
        {status || 'In Pool'}
      </span>
    );
  };

  const statusCounts = useMemo(() => {
    let approved = 0;
    let unapproved = 0;
    let rejected = 0;
    let icon = 0;
    let organizerAdded = 0;
    let publicRegistered = 0;

    players.forEach((p) => {
      if (p.approvalStatus === 'Approved') {
        approved++;
      } else {
        unapproved++;
      }

      if (p.approvalStatus === 'Rejected') {
        rejected++;
      }

      const isIconPlayer = Boolean(p.isIcon) || p.auctionStatus?.trim().toLowerCase() === 'icon';
      if (isIconPlayer) {
        icon++;
      }

      if (p.source === 'Organizer') {
        organizerAdded++;
      } else {
        publicRegistered++;
      }
    });

    return {
      ALL: players.length,
      APPROVED: approved,
      UNAPPROVED: unapproved,
      REJECTED: rejected,
      ICON: icon,
      ORGANIZER: organizerAdded,
      PUBLIC: publicRegistered,
    };
  }, [players]);

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      // 1. Status / Source Filter
      if (activeTab === 'APPROVED') {
        if (player.approvalStatus !== 'Approved') return false;
      } else if (activeTab === 'UNAPPROVED') {
        if (player.approvalStatus === 'Approved') return false;
      } else if (activeTab === 'REJECTED') {
        if (player.approvalStatus !== 'Rejected') return false;
      } else if (activeTab === 'ICON') {
        const isIconPlayer = Boolean(player.isIcon) || player.auctionStatus?.trim().toLowerCase() === 'icon';
        if (!isIconPlayer) return false;
      } else if (activeTab === 'ORGANIZER') {
        if (player.source !== 'Organizer') return false;
      } else if (activeTab === 'PUBLIC') {
        if (player.source === 'Organizer') return false;
      }

      // 2. Search Query Filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const name = (player.name || '').toLowerCase();
        const city = (player.city || '').toLowerCase();
        const role = (player.role || '').toLowerCase();
        const category = (player.category || '').toLowerCase();
        const mobile = (player.mobile || '').toLowerCase();
        const fatherName = (player.fatherName || '').toLowerCase();
        const teamName = getTeamFullName(player.soldTo).toLowerCase();

        const matches =
          name.includes(query) ||
          city.includes(query) ||
          role.includes(query) ||
          category.includes(query) ||
          mobile.includes(query) ||
          fatherName.includes(query) ||
          teamName.includes(query);

        if (!matches) return false;
      }

      return true;
    });
  }, [players, activeTab, searchQuery, teams]);

  const STATUS_TABS = [
    {
      key: 'ALL',
      label: 'All',
      count: statusCounts.ALL,
      activeClass: 'bg-slate-900 text-white border-slate-900',
      badgeClass: 'bg-white/20 text-white',
      inactiveBadgeClass: 'bg-slate-100 text-slate-700'
    },
    {
      key: 'APPROVED',
      label: 'Approved',
      count: statusCounts.APPROVED,
      activeClass: 'bg-emerald-600 text-white border-emerald-600',
      badgeClass: 'bg-emerald-700/60 text-white',
      inactiveBadgeClass: 'bg-emerald-50 text-emerald-800'
    },
    {
      key: 'UNAPPROVED',
      label: 'Unapproved',
      count: statusCounts.UNAPPROVED,
      activeClass: 'bg-amber-600 text-white border-amber-600',
      badgeClass: 'bg-amber-700/60 text-white',
      inactiveBadgeClass: 'bg-amber-50 text-amber-800'
    },
    {
      key: 'REJECTED',
      label: 'Rejected',
      count: statusCounts.REJECTED,
      activeClass: 'bg-rose-600 text-white border-rose-600',
      badgeClass: 'bg-rose-700/60 text-white',
      inactiveBadgeClass: 'bg-rose-50 text-rose-800'
    },
    {
      key: 'ICON',
      label: 'Icon',
      count: statusCounts.ICON,
      activeClass: 'bg-amber-400 text-amber-950 font-black border-amber-400',
      badgeClass: 'bg-amber-500/40 text-amber-950',
      inactiveBadgeClass: 'bg-amber-100 text-amber-900'
    },
    {
      key: 'ORGANIZER',
      label: 'Added by Organizer',
      count: statusCounts.ORGANIZER,
      activeClass: 'bg-blue-600 text-white border-blue-600',
      badgeClass: 'bg-blue-700/60 text-white',
      inactiveBadgeClass: 'bg-blue-50 text-blue-700'
    },
    {
      key: 'PUBLIC',
      label: 'Public Registration',
      count: statusCounts.PUBLIC,
      activeClass: 'bg-purple-600 text-white border-purple-600',
      badgeClass: 'bg-purple-700/60 text-white',
      inactiveBadgeClass: 'bg-purple-50 text-purple-700'
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/70 font-sans text-slate-900 selection:bg-indigo-500 selection:text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* 🌟 1. Top SaaS Header 🌟 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                PLAYER ROSTER & APPROVALS
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {players.length} Total Players
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              🛠️ Player Management
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
              Review registrations, approve auction pool players, assign base prices, categories & ICON status.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-white font-bold text-xs sm:text-sm shadow-xs transition"
            >
              <span>←</span>
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>

        {/* 🌟 2. Direct Header Status Options (NO filter icon/popup) & Search Bar 🌟 */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs space-y-3.5">
          {/* Status Tabs Header */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Filter by Status:
              </span>
              <span className="text-xs font-bold text-slate-500">
                Showing <strong className="text-slate-900 font-black">{filteredPlayers.length}</strong> of {players.length}
              </span>
            </div>

            {/* Direct Visible Status Tabs / Chips (Scrollable row on mobile, no page overflow) */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 scrollbar-none -mx-1 px-1">
              {STATUS_TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border shrink-0 transition flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                      isActive
                        ? `${tab.activeClass} shadow-xs ring-2 ring-offset-1 ring-slate-400/30`
                        : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                        isActive ? tab.badgeClass : tab.inactiveBadgeClass
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Row */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 text-sm">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, role, city, category, mobile..."
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-600 focus:outline-none transition shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 font-bold text-sm"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {(activeTab !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ALL');
                  setSearchQuery('');
                }}
                className="px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shrink-0 transition"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* 🌟 3. Mobile View: Stacked Player Cards (360px - 480px width) 🌟 */}
        <div className="block md:hidden space-y-3">
          {filteredPlayers.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 font-semibold text-sm shadow-2xs space-y-2">
              <p>No players found matching current filter ({activeTab}){searchQuery ? ` and search "${searchQuery}"` : ''}.</p>
              {(activeTab !== 'ALL' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => { setActiveTab('ALL'); setSearchQuery(''); }}
                  className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs"
                >
                  Clear filter & search
                </button>
              )}
            </div>
          ) : (
            filteredPlayers.map((player, index) => (
              <div
                key={player._id}
                className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3"
              >
                {/* Top Row: Avatar + Name + ICON badge */}
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openDetailsModal(player)}
                    className="flex items-center gap-3 text-left min-w-0 flex-1 group"
                  >
                    <img
                      src={player.photoUrl || 'https://via.placeholder.com/50'}
                      alt={player.name}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-slate-400 font-black">#{index + 1}</span>
                        <h3 className="font-bold text-slate-900 text-sm truncate group-hover:text-indigo-600 transition">
                          {player.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                          {player.role}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          📍 {player.city || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </button>

                  {player.isIcon && (
                    <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 shrink-0">
                      ⭐ ICON
                    </span>
                  )}
                </div>

                {/* Middle Row: Inline Category & Base Price Inputs */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      defaultValue={player.category || ''}
                      placeholder="e.g. Gold"
                      onBlur={(e) => handleCategoryUpdate(player._id, e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-slate-50 font-bold text-xs text-purple-700 focus:bg-white focus:border-indigo-600 focus:outline-none transition"
                      disabled={player.isIcon || player.auctionStatus === 'Sold'}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Base Price (₹)
                    </label>
                    <input
                      type="number"
                      defaultValue={player.basePrice}
                      onBlur={(e) => handlePriceUpdate(player._id, e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-slate-50 font-black text-xs text-emerald-700 focus:bg-white focus:border-indigo-600 focus:outline-none transition"
                      disabled={player.isIcon || player.auctionStatus === 'Sold'}
                    />
                  </div>
                </div>

                {/* Status & Source Row */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                  <span className="text-[11px] font-medium text-slate-500 truncate">
                    {getSourceLabel(player.source)}
                  </span>
                  
                  {player.approvalStatus === 'Pending' ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleApproval(player._id, 'Approved')}
                        className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs px-3 py-1 rounded-lg transition shadow-xs"
                      >
                        ✓ Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproval(player._id, 'Rejected')}
                        className="bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs px-2.5 py-1 rounded-lg transition shadow-xs"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                      {renderApprovalStatusPill(player.approvalStatus)}
                      {renderAuctionStatusPill(player.auctionStatus, player.soldTo)}
                    </div>
                  )}
                </div>

                {/* Action Buttons Row */}
                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => openDetailsModal(player)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                  >
                    Details 🔍
                  </button>
                  <button
                    type="button"
                    onClick={() => openIconModal(player)}
                    disabled={player.isIcon || player.auctionStatus === 'Sold'}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold text-xs transition disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Make ICON"
                  >
                    ⭐ Make ICON
                  </button>
                  {player.isIcon && (
                    <button
                      type="button"
                      onClick={() => handleRemoveIcon(player)}
                      className="px-2.5 py-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-300 font-bold text-xs transition"
                      title="Remove ICON"
                    >
                      Remove ICON ✕
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(player._id, player.name)}
                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 border border-rose-200 transition"
                    title="Delete Player"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 🌟 4. Desktop View: Modern Data Table (md and above) 🌟 */}
        <div className="hidden md:block bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 text-xs font-black uppercase tracking-wider">
                  <th className="p-4 w-16">S. No.</th>
                  <th className="p-4">Player</th>
                  <th className="p-4">Role / City</th>
                  <th className="p-4 w-36">Category</th>
                  <th className="p-4">Source</th>
                  <th className="p-4 w-36">Base Price</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-slate-500 font-medium text-sm space-y-2">
                      <p>No players found matching current filter ({activeTab}){searchQuery ? ` and search "${searchQuery}"` : ''}.</p>
                      {(activeTab !== 'ALL' || searchQuery) && (
                        <button
                          type="button"
                          onClick={() => { setActiveTab('ALL'); setSearchQuery(''); }}
                          className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs"
                        >
                          Clear filter & search
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredPlayers.map((player, index) => (
                    <tr key={player._id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="p-4 font-bold text-xs text-slate-500">{index + 1}</td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => openDetailsModal(player)}
                          className="flex items-center space-x-3 text-left w-full group/item"
                        >
                          <img
                            src={player.photoUrl || 'https://via.placeholder.com/50'}
                            alt={player.name}
                            className="w-11 h-11 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm group-hover/item:text-indigo-600 transition truncate">
                              {player.name}
                            </p>
                            {player.isIcon && (
                              <span className="inline-block mt-0.5 bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                                ⭐ ICON
                              </span>
                            )}
                          </div>
                        </button>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-indigo-700 text-xs">{player.role}</p>
                        <p className="text-xs text-slate-500 font-medium">📍 {player.city || 'N/A'}</p>
                      </td>
                      <td className="p-4">
                        <input
                          type="text"
                          defaultValue={player.category || ''}
                          placeholder="Category"
                          onBlur={(e) => handleCategoryUpdate(player._id, e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/70 focus:bg-white focus:border-indigo-600 outline-none font-bold text-xs text-purple-700 transition"
                          disabled={player.isIcon || player.auctionStatus === 'Sold'}
                        />
                      </td>
                      <td className="p-4 font-semibold text-xs text-slate-600">
                        {getSourceLabel(player.source)}
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          defaultValue={player.basePrice}
                          onBlur={(e) => handlePriceUpdate(player._id, e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50/70 focus:bg-white focus:border-indigo-600 outline-none font-black text-xs text-emerald-700 transition"
                          disabled={player.isIcon || player.auctionStatus === 'Sold'}
                        />
                      </td>
                      <td className="p-4 text-center">
                        {player.approvalStatus === 'Pending' ? (
                          <div className="flex justify-center items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleApproval(player._id, 'Approved')}
                              className="bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 active:bg-emerald-200 px-2.5 py-1 rounded-lg font-bold text-xs transition shadow-2xs"
                              title="Approve Player"
                            >
                              ✔ Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproval(player._id, 'Rejected')}
                              className="bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100 active:bg-rose-200 px-2 py-1 rounded-lg font-bold text-xs transition shadow-2xs"
                              title="Reject Player"
                            >
                              ✖ Reject
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            {renderApprovalStatusPill(player.approvalStatus)}
                            {renderAuctionStatusPill(player.auctionStatus, player.soldTo)}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => openIconModal(player)}
                            disabled={player.isIcon || player.auctionStatus === 'Sold'}
                            className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 flex items-center justify-center font-black text-sm shadow-2xs disabled:opacity-30 disabled:cursor-not-allowed transition"
                            title="Make ICON"
                          >
                            ⭐
                          </button>
                          {player.isIcon && (
                            <button
                              type="button"
                              onClick={() => handleRemoveIcon(player)}
                              className="w-8 h-8 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 flex items-center justify-center font-bold text-xs shadow-2xs transition"
                              title="Remove ICON"
                            >
                              ⭐✕
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openDetailsModal(player)}
                            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 flex items-center justify-center font-bold text-sm shadow-2xs transition"
                            title="View Player Details"
                          >
                            🔍
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(player._id, player.name)}
                            className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border border-rose-200 flex items-center justify-center font-bold text-sm transition shadow-2xs"
                            title="Delete Player"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 🌟 4. Assign ICON Modal 🌟 */}
      {isIconModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 sm:p-8 rounded-3xl w-full max-w-md border border-slate-200 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">⭐</span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">Assign ICON Player</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsIconModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-lg transition"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-500 font-medium mb-4">
              Assigning <strong className="text-slate-900">{selectedPlayer?.name}</strong> directly to a team franchise as an Icon player.
            </p>

            <form onSubmit={handleMakeIconSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Select Team *
                </label>
                <div className="relative">
                  <select
                    required
                    value={iconTeam}
                    onChange={(e) => setIconTeam(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-bold text-sm bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="">-- Choose Team --</option>
                    {teams.map(t => (
                      <option key={t._id} value={t._id}>
                        {t.teamName} {t.shortName ? `(${t.shortName})` : ''} (Max Bid: ₹{Number(t.maxBid || 0).toLocaleString()})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500">
                    ▼
                  </div>
                </div>
              </div>

              {selectedIconTeamData && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-xs font-bold space-y-0.5">
                  <p>Dynamic Max Bid: ₹{Number(selectedIconTeamData.maxBid || 0).toLocaleString()}</p>
                  <p className="text-[11px] text-amber-700 font-semibold">
                    Required Players Left: {Number(selectedIconTeamData.remainingRequiredPlayers || 0)}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  ICON Contract Price (₹) *
                </label>
                <input
                  required
                  type="number"
                  value={iconPrice}
                  onChange={(e) => setIconPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-black text-sm text-emerald-700 bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsIconModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 py-3 rounded-xl font-bold text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black py-3 rounded-xl text-sm shadow-md shadow-amber-400/25 transition active:scale-95"
                >
                  Assign ICON ⭐
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 5. Player Details Modal 🌟 */}
      {isDetailsModalOpen && selectedPlayer && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 sm:p-8 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl">
            <div className="flex justify-between items-start gap-4 mb-6 pb-4 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 w-full">
                <div className="relative group shrink-0">
                  <img
                    src={selectedPlayer.photoUrl || 'https://via.placeholder.com/80'}
                    alt={selectedPlayer.name}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border border-slate-200 shadow-sm cursor-pointer"
                    onClick={() => { if(selectedPlayer.photoUrl) setPhotoViewMode(true); }}
                  />
                  <div className="flex flex-col gap-1 mt-2">
                    {selectedPlayer.photoUrl && (
                      <button 
                        type="button" 
                        onClick={handleDownloadPhoto}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold py-1 px-2 rounded-lg transition text-center"
                      >
                        ⬇️ Download
                      </button>
                    )}
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingPhoto}
                      className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold py-1 px-2 rounded-lg transition text-center disabled:opacity-50"
                    >
                      {isUploadingPhoto ? '⏳ Uploading...' : '✏️ Change Photo'}
                    </button>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
                <div className="flex flex-col text-center sm:text-left mt-2 sm:mt-0">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900">{selectedPlayer.name}</h2>
                    {selectedPlayer.isIcon && (
                      <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                        ⭐ ICON
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Source: <span className="text-slate-800 font-bold">{getSourceLabel(selectedPlayer.source)}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xl transition shrink-0"
              >
                &times;
              </button>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Father Name</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedPlayer.fatherName || '-'}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Age</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedPlayer.age || '-'}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Mobile</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedPlayer.mobile || '-'}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">City</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedPlayer.city || '-'}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Role</p>
                <p className="font-bold text-indigo-700 text-sm mt-0.5">{selectedPlayer.role || '-'}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Category</p>
                <p className="font-bold text-purple-700 text-sm mt-0.5">{selectedPlayer.category || '-'}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Base Price</p>
                <p className="font-black text-emerald-700 text-sm mt-0.5">₹ {selectedPlayer.basePrice || 0}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Approval</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedPlayer.approvalStatus || '-'}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Auction Status</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedPlayer.auctionStatus || '-'}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Sold To</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedPlayer.soldTo ? getTeamFullName(selectedPlayer.soldTo) : '-'}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Sold Price</p>
                <p className="font-black text-emerald-700 text-sm mt-0.5">₹ {selectedPlayer.soldPrice || 0}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">ICON Player</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedPlayer.isIcon ? 'Yes' : 'No'}</p>
              </div>
            </div>

            {/* Custom Registration Fields Section */}
            <div>
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-700 mb-3">
                Additional Custom Registration Fields
              </h3>
              {renderCustomData(selectedPlayer.customData)}
            </div>
          </div>
        </div>
      )}

      {/* Full-size Photo View Modal */}
      {photoViewMode && selectedPlayer?.photoUrl && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
          <button 
            type="button"
            onClick={() => setPhotoViewMode(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 text-4xl"
          >
            &times;
          </button>
          <img 
            src={selectedPlayer.photoUrl} 
            alt={selectedPlayer.name} 
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl border-2 border-white/20" 
          />
        </div>
      )}

      {/* Image Cropper Modal */}
      <ImageCropperModal
        isOpen={cropperOpen}
        imageSrc={rawImageSrc}
        onCropComplete={handleCropComplete}
        onCancel={() => setCropperOpen(false)}
        aspectRatio={1}
        title="Crop Player Photo"
      />
    </div>
  );
}

export default ManagePlayers;
