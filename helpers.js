// helpers.js
export function makeListingId(){
  return `${Date.now()}_${Math.floor(Math.random()*10000)}`;
}

export function saveToLocal(key, obj){
  localStorage.setItem(key, JSON.stringify(obj || {}));
}
export function loadFromLocal(key){
  try { return JSON.parse(localStorage.getItem(key)); } catch(e) { return null; }
}
