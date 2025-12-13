import React, { useState } from 'react';

interface Favorite {
    id: string;
    name: string;
    // Other favorite details would go here
}

interface FavoritesManagerProps {
  favorites: Favorite[];
  onSelectFavorite: (fav: Favorite) => void;
}

const FavoritesManager: React.FC<FavoritesManagerProps> = ({ favorites, onSelectFavorite }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm mt-4">
      <h4 className="text-md font-semibold mb-2">My Favorites</h4>
      {favorites.length === 0 ? (
        <p className="text-sm text-gray-500">No favorites saved yet.</p>
      ) : (
        <ul className="space-y-2">
          {favorites.map(fav => (
            <li key={fav.id}>
              <button 
                onClick={() => onSelectFavorite(fav)}
                className="w-full text-left p-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
              >
                {fav.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FavoritesManager;
