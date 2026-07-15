import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import RecipeAppIntegration from './RecipeAppIntegration';
import { installRecipeEdgeFallback } from './utils/recipeEdgeFallback';
import './index.css';

installRecipeEdgeFallback();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RecipeAppIntegration />
  </StrictMode>,
);
