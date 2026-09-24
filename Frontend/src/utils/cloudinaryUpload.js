import axios from 'axios';

export const CLOUD_NAME = "dpg5olqt7";
export const UPLOAD_PRESET = "auction_preset";

/**
 * Uploads a file or cropped Blob to Cloudinary.
 * @param {File|Blob} fileOrBlob 
 * @param {string} filename 
 * @param {Object} options - { onUploadProgress }
 * @returns {Promise<string>} secure_url
 */
export async function uploadImageToCloudinary(fileOrBlob, filename = 'player-photo.jpg', options = {}) {
  const data = new FormData();
  if (fileOrBlob instanceof Blob && !(fileOrBlob instanceof File)) {
    data.append("file", fileOrBlob, filename);
  } else {
    data.append("file", fileOrBlob);
  }
  data.append("upload_preset", UPLOAD_PRESET);
  data.append("cloud_name", CLOUD_NAME);

  const res = await axios.post(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    data,
    {
      onUploadProgress: options.onUploadProgress,
      headers: { 'Content-Type': 'multipart/form-data' }
    }
  );

  if (res.data && res.data.secure_url) {
    return res.data.secure_url;
  }
  throw new Error('Cloudinary response did not return a secure_url');
}
