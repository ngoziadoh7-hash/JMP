// ====================
// JMPOTTERS APP - COMPLETE WITH WORKING CHECKOUT & PLAIN ORDER NUMBERS
// ====================
(function() {
    'use strict';
    
    if (window.JMPOTTERS_APP_INITIALIZED) {
        console.warn('⚠️ JMPOTTERS app already initialized, skipping...');
        return;
    }
    
    console.log('🚀 JMPOTTERS app starting...');
    window.JMPOTTERS_APP_INITIALIZED = true;
    
    // ====================
    // CONFIGURATION
    // ====================
    if (!window.JMPOTTERS_CONFIG) {
        window.JMPOTTERS_CONFIG = {};
    }
    
    window.JMPOTTERS_CONFIG.supabase = {
        url: 'https://tmpggeeuwdvlngvfncaa.supabase.co',
        key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcGdnZWV1d2R2bG5ndmZuY2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxOTc0MDYsImV4cCI6MjA3Nzc3MzQwNn0.EKzkKWmzYMvQuN11vEjRTDHrUbh6dYXk7clxVsYQ0b4'
    };
    
    window.JMPOTTERS_CONFIG.images = {
        baseUrl: 'https://ebuzome.github.io/JMPOTTERS/assets/images/',
        paths: {
            'mensfootwear': 'mensfootwear/',
            'womensfootwear': '',
            'bags': '',
            'household': 'household2/',
            'kids': 'kids/',
            'accessories': 'accessories/',
            'healthcare': ''
        }
    };
    
    // Current product state
    let currentProduct = null;
    let currentSelectedQuantity = 1;
    let currentSelectedColor = null;
    let currentSelectedSize = null;
    let currentSelectedVariant = null;
    let currentProductColors = [];
    let currentProductSizes = [];
    let colorSizeMap = {};
    let sizeColorMap = {};
    
    // Checkout processing flag
    let isProcessingCheckout = false;
    
    // ====================
    // NOTIFICATION SYSTEM
    // ====================
    function showNotification(message, type = 'success') {
        console.log(`${type.toUpperCase()}: ${message}`);
        
        let container = document.getElementById('jmpottersNotificationContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'jmpottersNotificationContainer';
            container.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 12px;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }
        
        const notification = document.createElement('div');
        const colors = {
            success: { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
            error: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
            warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
            info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' }
        };
        const color = colors[type];
        notification.style.cssText = `
            background: ${color.bg};
            border-left: 4px solid ${color.border};
            border-radius: 12px;
            padding: 14px 18px;
            min-width: 280px;
            max-width: 380px;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideIn 0.3s ease;
            pointer-events: auto;
            color: ${color.text};
            font-size: 0.875rem;
            font-weight: 500;
        `;
        notification.innerHTML = `<span>${message}</span><button style="background:none;border:none;margin-left:auto;cursor:pointer;opacity:0.6" onclick="this.parentElement.remove()">✕</button>`;
        container.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
    }
    
    const style = document.createElement('style');
    style.textContent = `@keyframes slideIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }`;
    document.head.appendChild(style);
    
    // ====================
    // UTILITY FUNCTIONS
    // ====================
    function getCurrentCategory() {
        if (window.JMPOTTERS_CONFIG && window.JMPOTTERS_CONFIG.currentCategory) {
            return window.JMPOTTERS_CONFIG.currentCategory;
        }
        const path = window.location.pathname;
        const page = path.split('/').pop().replace('.html', '');
        const pageToCategory = {
            'mensfootwear': 'mensfootwear',
            'womensfootwear': 'womensfootwear',
            'bags': 'bags',
            'household': 'household',
            'kids': 'kids',
            'accessories': 'accessories',
            'healthcare': 'healthcare',
            'product': 'mensfootwear'
        };
        return pageToCategory[page] || 'mensfootwear';
    }
    
    function isProductPage() {
        return window.location.pathname.includes('product.html');
    }
    
    function getSlugFromURL() {
        if (!isProductPage()) return null;
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('slug') ? decodeURIComponent(urlParams.get('slug')) : null;
    }
    
    function getImageUrl(categorySlug, imageFilename) {
        if (!imageFilename) return window.JMPOTTERS_CONFIG.images.baseUrl + 'placeholder.jpg';
        if (imageFilename.startsWith('https://tmpggeeuwdvlngvfncaa.supabase.co')) return imageFilename;
        if (imageFilename.startsWith('http')) return imageFilename;
        const config = window.JMPOTTERS_CONFIG.images;
        const folder = config.paths[categorySlug] || '';
        return config.baseUrl + folder + imageFilename;
    }
    
    function formatPrice(price) {
        if (!price && price !== 0) return '₦0';
        return `₦${parseInt(price).toLocaleString()}`;
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function safeParseJSON(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(key)) || fallback;
        } catch (e) {
            console.error('Failed to parse ' + key + ':', e);
            localStorage.removeItem(key);
            return fallback;
        }
    }
    
    function getSupabaseClient() {
        if (window.JMPOTTERS_SUPABASE_CLIENT) return window.JMPOTTERS_SUPABASE_CLIENT;
        if (window.supabase && window.supabase.createClient) {
            const config = window.JMPOTTERS_CONFIG.supabase;
            window.JMPOTTERS_SUPABASE_CLIENT = window.supabase.createClient(config.url, config.key);
            console.log('✅ Supabase client ready');
            return window.JMPOTTERS_SUPABASE_CLIENT;
        }
        console.error('❌ Supabase not loaded');
        return null;
    }
    
    // ====================
    // GET NEXT SEQUENTIAL ORDER NUMBER (PLAIN DIGITS ONLY)
    // ====================
    async function getNextOrderNumber() {
        const supabase = getSupabaseClient();
        if (!supabase) return '0001';
        
        try {
            // Get the highest order number from existing orders
            const { data, error } = await supabase
                .from('orders')
                .select('order_number')
                .order('created_at', { ascending: false })
                .limit(1);
            
            if (error) throw error;
            
            let highestNumber = 0;
            
            if (data && data.length > 0 && data[0].order_number) {
                // Extract numeric part (remove any non-numeric characters just in case)
                const numericPart = String(data[0].order_number).replace(/\D/g, '');
                if (numericPart) {
                    highestNumber = parseInt(numericPart, 10);
                }
            }
            
            // Increment by 1
            const nextNumber = highestNumber + 1;
            // Pad with zeros to 4 digits (0001, 0002, etc.)
            const paddedNumber = nextNumber.toString().padStart(4, '0');
            return paddedNumber;
            
        } catch (error) {
            console.error('Error getting next order number:', error);
            return Date.now().toString().slice(-4);
        }
    }
    
    // ====================
    // RECOMMENDATION ENGINE
    // ====================
    async function loadRecommendations(currentProduct) {
        try {
            const supabase = getSupabaseClient();
            if (!supabase) return [];
            
            const currentCategoryId = currentProduct.category_id;
            const currentProductName = currentProduct.name.toLowerCase();
            const currentProductId = currentProduct.id;
            
            const nameWords = currentProductName.split(' ').filter(w => w.length > 2);
            let recommendations = [];
            
            if (nameWords.length > 0) {
                let nameQuery = supabase
                    .from('products')
                    .select('id, name, price, image_url, slug, stock, category_id')
                    .eq('is_active', true)
                    .neq('id', currentProductId);
                
                if (nameWords.length > 1) {
                    nameQuery = nameQuery.or(nameWords.map(w => `name.ilike.%${w}%`).join(','));
                } else {
                    nameQuery = nameQuery.ilike('name', `%${nameWords[0]}%`);
                }
                
                const { data: keywordMatches, error: keywordError } = await nameQuery.limit(10);
                if (keywordError) console.error('Keyword recommendations query failed:', keywordError);
                if (keywordMatches && keywordMatches.length > 0) {
                    recommendations = keywordMatches;
                }
            }
            
            if (recommendations.length < 15) {
                const needed = 15 - recommendations.length;
                const existingIds = recommendations.map(r => r.id);
                let categoryQuery = supabase
                    .from('products')
                    .select('id, name, price, image_url, slug, stock, category_id')
                    .eq('category_id', currentCategoryId)
                    .eq('is_active', true)
                    .neq('id', currentProductId);
                
                if (existingIds.length > 0) {
                    categoryQuery = categoryQuery.not('id', 'in', `(${existingIds.join(',')})`);
                }
                
                const { data: categoryProducts, error: categoryError } = await categoryQuery.limit(needed);
                if (categoryError) console.error('Category recommendations query failed:', categoryError);
                if (categoryProducts && categoryProducts.length > 0) {
                    recommendations = [...recommendations, ...categoryProducts];
                }
            }
            
            if (recommendations.length < 15) {
                const needed = 15 - recommendations.length;
                const existingIds = recommendations.map(r => r.id);
                let randomQuery = supabase
                    .from('products')
                    .select('id, name, price, image_url, slug, stock, category_id')
                    .eq('is_active', true)
                    .neq('id', currentProductId);
                
                if (existingIds.length > 0) {
                    randomQuery = randomQuery.not('id', 'in', `(${existingIds.join(',')})`);
                }
                
                const { data: randomProducts, error: randomError } = await randomQuery.limit(needed);
                if (randomError) console.error('Random recommendations query failed:', randomError);
                if (randomProducts && randomProducts.length > 0) {
                    recommendations = [...recommendations, ...randomProducts];
                }
            }
            
            recommendations = recommendations.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
            recommendations = recommendations.slice(0, 15);
            return recommendations;
            
        } catch (error) {
            console.error('Error loading recommendations:', error);
            return [];
        }
    }
    
    async function renderRecommendations(currentProduct) {
        const section = document.getElementById('recommendationsSection');
        const container = document.getElementById('recommendationsContainer');
        if (!section || !container) return;
        
        const recommendations = await loadRecommendations(currentProduct);
        if (recommendations.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        let html = '';
        for (const product of recommendations) {
            const categorySlug = currentProduct.category_slug || getCurrentCategory();
            const imageUrl = getImageUrl(categorySlug, product.image_url);
            html += `
                <a href="product.html?slug=${product.slug}" class="recommendation-card">
                    <img src="${imageUrl}" alt="${product.name}" class="rec-image"
                         onerror="this.src='${window.JMPOTTERS_CONFIG.images.baseUrl}placeholder.jpg'">
                    <div class="rec-info">
                        <div class="rec-name">${escapeHtml(product.name)}</div>
                        <div class="rec-price">${formatPrice(product.price)}</div>
                        <div class="text-xs ${product.stock > 0 ? 'text-green-600' : 'text-red-600'} mt-1">
                            ${product.stock > 0 ? 'In Stock' : 'Out of Stock'}
                        </div>
                    </div>
                </a>
            `;
        }
        container.innerHTML = html;
        section.style.display = 'block';
    }
    
    // ====================
    // LOAD SINGLE PRODUCT
    // ====================
    async function loadSingleProductBySlug(slug) {
        console.log(`📦 Loading single product by slug: ${slug}`);
        
        const productViewer = document.getElementById('productViewer');
        const loadingState = document.getElementById('loadingState');
        const errorState = document.getElementById('errorState');
        
        if (!productViewer) return;
        if (errorState) errorState.style.display = 'none';
        if (loadingState) loadingState.style.display = 'block';
        
        const supabase = getSupabaseClient();
        if (!supabase) {
            showError('Database connection error');
            return;
        }
        
        try {
            const { data: product, error: productError } = await supabase
                .from('products')
                .select('*')
                .eq('slug', slug)
                .eq('is_active', true)
                .single();
            
            if (productError || !product) throw new Error('Product not found');
            
            console.log('✅ Loaded product:', product.name);
            
            const { data: category, error: categoryError } = await supabase
                .from('categories')
                .select('id, name, slug')
                .eq('id', product.category_id)
                .single();
            if (categoryError) console.error('Failed to load category:', categoryError);
            
            const { data: colors, error: colorsError } = await supabase
                .from('product_colors')
                .select('*')
                .eq('product_id', product.id)
                .order('sort_order');
            if (colorsError) console.error('Failed to load colors:', colorsError);
            
            const { data: sizes, error: sizesError } = await supabase
                .from('product_sizes')
                .select('*')
                .eq('product_id', product.id)
                .order('size_value');
            if (sizesError) console.error('Failed to load sizes:', sizesError);
            
            document.title = `${product.name} - JMPOTTERS`;
            
            currentProduct = product;
            currentProduct.category_slug = category?.slug || getCurrentCategory();
            currentProduct.category_name = category?.name || 'Category';
            currentProductColors = colors || [];
            currentProductSizes = sizes || [];
            currentSelectedQuantity = 1;
            currentSelectedColor = null;
            currentSelectedSize = null;
            
            buildColorSizeMappings(currentProductColors, currentProductSizes);
            renderProductPage(currentProduct);
            await renderRecommendations(currentProduct);
            
            if (loadingState) loadingState.style.display = 'none';
            
        } catch (error) {
            console.error('Error:', error);
            showError(error.message || 'Failed to load product');
        }
    }
    
    function showError(message) {
        const loadingState = document.getElementById('loadingState');
        const errorState = document.getElementById('errorState');
        const errorMessage = document.getElementById('errorMessage');
        if (loadingState) loadingState.style.display = 'none';
        if (errorState) {
            errorState.style.display = 'block';
            if (errorMessage) errorMessage.textContent = message;
        }
    }
    
    function renderProductPage(product) {
        const productViewer = document.getElementById('productViewer');
        if (!productViewer) return;
        
        const categorySlug = product.category_slug || getCurrentCategory();
        const imageUrl = getImageUrl(categorySlug, product.image_url);
        const isFootwear = ['mensfootwear', 'womensfootwear'].includes(categorySlug);
        const hasComparePrice = product.compare_price && product.compare_price > product.price;
        const discountPercent = hasComparePrice ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100) : 0;
        
        const wishlist = safeParseJSON('jmpotters_wishlist', []);
        const isInWishlist = wishlist.some(item => item.id === product.id);
        
        const stockStatus = product.stock > 10 ? 'in-stock' : (product.stock > 0 ? 'low-stock' : 'out-of-stock');
        const stockText = product.stock > 10 ? 'In Stock' : (product.stock > 0 ? `Only ${product.stock} left` : 'Out of Stock');
        
        productViewer.innerHTML = `
            <div class="product-container">
                <div class="product-image-section" id="productImageSection">
                    <div class="product-image-wrapper">
                        <img src="${imageUrl}" alt="${product.name}" class="product-image"
                             onerror="this.onerror=null; this.src='${window.JMPOTTERS_CONFIG.images.baseUrl}placeholder.jpg'">
                        <div class="magnify-icon"><i class="icon-zoom-in"></i></div>
                    </div>
                </div>
                <div class="product-details">
                    <h1 class="product-title">${escapeHtml(product.name)}</h1>
                    <div class="price-section">
                        <span class="current-price">${formatPrice(product.price)}</span>
                        ${hasComparePrice ? `<span class="original-price">${formatPrice(product.compare_price)}</span>` : ''}
                        ${hasComparePrice ? `<span class="discount-badge">-${discountPercent}%</span>` : ''}
                    </div>
                    <div class="stock-tile">
                        <div class="stock-status ${stockStatus}">
                            <i class="${product.stock > 0 ? 'icon-check-circle' : 'icon-x-circle'}"></i>
                            <span>${stockText}</span>
                        </div>
                    </div>
                    <div class="description-tile">
                        <div class="tile-label"><i class="icon-info"></i> Description</div>
                        <div class="product-description">${product.description ? product.description.replace(/\n/g, '<br>') : 'Premium quality product from JMPOTTERS.'}</div>
                    </div>
                    ${isFootwear && currentProductColors.length > 0 ? `
                        <div class="variant-tile">
                            <div class="tile-label"><i class="icon-palette"></i> Select Color</div>
                            <div class="color-options" id="colorOptions">
                                ${currentProductColors.map(color => `<div class="color-option" data-color-id="${color.id}" data-color-name="${color.color_name}" style="background: ${color.color_code ? `linear-gradient(135deg, ${color.color_code.split('+').join(', ')})` : '#f3f4f6'};">${color.color_name}</div>`).join('')}
                            </div>
                        </div>
                        <div class="variant-tile">
                            <div class="tile-label"><i class="icon-ruler"></i> Select Size</div>
                            <div class="size-options" id="sizeOptions"><div class="text-gray-400 text-sm">Please select a color first</div></div>
                        </div>
                        <div class="selection-summary" id="selectionSummary" style="display: none;">
                            <div class="selected-variant"><span id="selectedColorName"></span> - <span id="selectedSizeValue"></span></div>
                            <div class="stock-info"><i class="icon-package"></i> Available Stock: <strong id="availableStock">0</strong></div>
                        </div>
                    ` : ''}
                    <div class="quantity-tile">
                        <div class="tile-label"><i class="icon-calculator"></i> Quantity</div>
                        <div class="quantity-controls">
                            <button class="quantity-btn minus">-</button>
                            <input type="number" id="productQuantity" value="1" min="1" max="${product.stock || 100}">
                            <button class="quantity-btn plus">+</button>
                        </div>
                        <div class="bulk-options">
                            ${[2, 3, 5, 10].map(qty => `<button class="bulk-option" data-qty="${qty}">${qty} Units</button>`).join('')}
                        </div>
                    </div>
                    <div class="action-buttons">
                        <button class="action-btn btn-add-cart" id="pageAddToCart"><i class="icon-shopping-cart"></i> Add to Cart</button>
                        <button class="action-btn btn-wishlist ${isInWishlist ? 'active' : ''}" id="pageWishlist"><i class="icon-heart"></i> ${isInWishlist ? 'Saved' : 'Wishlist'}</button>
                    </div>
                </div>
            </div>
        `;
        
        setupProductPageInteractions();
    }
    
    function buildColorSizeMappings(colors, sizes) {
        colorSizeMap = {};
        sizeColorMap = {};
        colors.forEach(color => { colorSizeMap[color.id] = sizes.filter(size => size.color_id === color.id); });
        const uniqueSizes = [...new Set(sizes.map(s => s.size_value))];
        uniqueSizes.forEach(sizeValue => {
            const sizeVariants = sizes.filter(s => s.size_value === sizeValue);
            sizeColorMap[sizeValue] = colors.filter(color => sizeVariants.some(s => s.color_id === color.id));
        });
    }
    
    function setupProductPageInteractions() {
        if (!isProductPage()) return;
        
        const colorOptions = document.getElementById('colorOptions');
        if (colorOptions) {
            colorOptions.addEventListener('click', (e) => {
                const colorOption = e.target.closest('.color-option');
                if (!colorOption) return;
                colorOptions.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
                colorOption.classList.add('selected');
                currentSelectedColor = { id: parseInt(colorOption.dataset.colorId), name: colorOption.dataset.colorName };
                updateSizeOptionsForColor(currentSelectedColor.id);
            });
        }
        
        const quantityInput = document.getElementById('productQuantity');
        const minusBtn = document.querySelector('.quantity-btn.minus');
        const plusBtn = document.querySelector('.quantity-btn.plus');
        
        if (quantityInput && minusBtn && plusBtn) {
            minusBtn.addEventListener('click', () => {
                let val = parseInt(quantityInput.value) || 1;
                if (val > 1) quantityInput.value = val - 1;
                currentSelectedQuantity = parseInt(quantityInput.value);
            });
            plusBtn.addEventListener('click', () => {
                let val = parseInt(quantityInput.value) || 1;
                const max = currentSelectedSize?.stock || currentProduct?.stock || 100;
                if (val < max) quantityInput.value = val + 1;
                currentSelectedQuantity = parseInt(quantityInput.value);
            });
            quantityInput.addEventListener('change', () => {
                let val = parseInt(quantityInput.value) || 1;
                const max = currentSelectedSize?.stock || currentProduct?.stock || 100;
                quantityInput.value = Math.max(1, Math.min(val, max));
                currentSelectedQuantity = parseInt(quantityInput.value);
            });
        }
        
        document.querySelectorAll('.bulk-option').forEach(opt => {
            opt.addEventListener('click', function() {
                document.querySelectorAll('.bulk-option').forEach(o => o.classList.remove('active'));
                this.classList.add('active');
                const qty = parseInt(this.dataset.qty);
                if (quantityInput) {
                    quantityInput.value = qty;
                    currentSelectedQuantity = qty;
                }
            });
        });
        
        const pageAddToCart = document.getElementById('pageAddToCart');
        if (pageAddToCart && currentProduct) {
            pageAddToCart.addEventListener('click', () => {
                const isFootwear = ['mensfootwear', 'womensfootwear'].includes(currentProduct.category_slug || getCurrentCategory());
                if (isFootwear && currentProductColors.length > 0) {
                    if (!currentSelectedColor) { showNotification('Please select a color', 'warning'); return; }
                    if (!currentSelectedSize) { showNotification('Please select a size', 'warning'); return; }
                    if (currentSelectedSize.stock === 0) { showNotification('This size is out of stock', 'error'); return; }
                    if (currentSelectedQuantity > currentSelectedSize.stock) { showNotification(`Only ${currentSelectedSize.stock} units available`, 'error'); return; }
                    addToCart(currentProduct, currentSelectedQuantity, {
                        color_id: currentSelectedColor.id, color_name: currentSelectedColor.name,
                        size_id: currentSelectedSize.id, size_value: currentSelectedSize.value,
                        variant_id: currentSelectedVariant?.id
                    });
                } else {
                    if (currentSelectedQuantity > currentProduct.stock) { showNotification(`Only ${currentProduct.stock} units available`, 'error'); return; }
                    addToCart(currentProduct, currentSelectedQuantity);
                }
            });
        }
        
        const pageWishlist = document.getElementById('pageWishlist');
        if (pageWishlist && currentProduct) {
            pageWishlist.addEventListener('click', () => {
                toggleWishlist(currentProduct);
                const isActive = pageWishlist.classList.contains('active');
                pageWishlist.classList.toggle('active');
                pageWishlist.innerHTML = `<i class="icon-heart"></i> ${isActive ? 'Wishlist' : 'Saved'}`;
            });
        }
    }
    
    function updateSizeOptionsForColor(colorId) {
        const sizeOptions = document.getElementById('sizeOptions');
        const selectionSummary = document.getElementById('selectionSummary');
        if (!sizeOptions) return;
        
        const availableSizes = colorSizeMap[colorId] || [];
        if (availableSizes.length === 0) {
            sizeOptions.innerHTML = '<div class="text-gray-400 text-sm">No sizes available for this color</div>';
            if (selectionSummary) selectionSummary.style.display = 'none';
            currentSelectedSize = null;
            currentSelectedVariant = null;
            return;
        }
        
        sizeOptions.innerHTML = availableSizes.map(size => {
            const stock = size.stock_quantity || 0;
            const disabledClass = stock === 0 ? 'disabled' : '';
            return `<div class="size-option ${disabledClass}" data-size-id="${size.id}" data-size-value="${size.size_value}" data-stock="${stock}" ${stock === 0 ? 'disabled' : ''}>${size.size_value}</div>`;
        }).join('');
        
        sizeOptions.querySelectorAll('.size-option:not(.disabled)').forEach(option => {
            option.addEventListener('click', function() {
                sizeOptions.querySelectorAll('.size-option').forEach(opt => opt.classList.remove('selected'));
                this.classList.add('selected');
                currentSelectedSize = { id: parseInt(this.dataset.sizeId), value: this.dataset.sizeValue, stock: parseInt(this.dataset.stock) };
                currentSelectedVariant = currentProductSizes.find(s => s.id === currentSelectedSize.id && s.color_id === currentSelectedColor?.id);
                if (selectionSummary) selectionSummary.style.display = 'block';
                document.getElementById('selectedColorName').textContent = currentSelectedColor.name;
                document.getElementById('selectedSizeValue').textContent = currentSelectedSize.value;
                document.getElementById('availableStock').textContent = currentSelectedSize.stock;
                const qtyInput = document.getElementById('productQuantity');
                if (qtyInput) {
                    qtyInput.max = currentSelectedSize.stock;
                    if (currentSelectedQuantity > currentSelectedSize.stock) {
                        currentSelectedQuantity = currentSelectedSize.stock;
                        qtyInput.value = currentSelectedSize.stock;
                    }
                }
            });
        });
    }
    
    // ====================
    // LOAD PRODUCTS BY CATEGORY
    // ====================
    async function loadProductsByCategory(categorySlug) {
        const productsGrid = document.getElementById('productsGrid');
        if (!productsGrid) return;
        
        productsGrid.innerHTML = '<div class="loading-spinner"><i class="icon-loader"></i><p>Loading products...</p></div>';
        
        const supabase = getSupabaseClient();
        if (!supabase) {
            productsGrid.innerHTML = '<div class="error-message">Database connection error</div>';
            return;
        }
        
        try {
            const { data: category, error: catError } = await supabase.from('categories').select('id').eq('slug', categorySlug).single();
            if (catError || !category) throw new Error('Category not found');
            
            const { data: products, error: productsError } = await supabase
                .from('products')
                .select('id, name, price, image_url, stock, slug')
                .eq('category_id', category.id)
                .eq('is_active', true)
                .order('created_at', { ascending: false });
            if (productsError) throw productsError;
            
            if (!products || products.length === 0) {
                productsGrid.innerHTML = '<div class="no-products">No products found</div>';
                return;
            }
            
            window.JMPOTTERS_PRODUCTS_CACHE = products;
            renderProducts(products, categorySlug);
            
        } catch (error) {
            console.error(error);
            productsGrid.innerHTML = '<div class="error-message">Error loading products</div>';
        }
    }
    
    function renderProducts(products, categorySlug) {
        const productsGrid = document.getElementById('productsGrid');
        if (!productsGrid) return;
        productsGrid.innerHTML = '';
        
        products.forEach(product => {
            const imageUrl = getImageUrl(categorySlug, product.image_url);
            const wishlist = safeParseJSON('jmpotters_wishlist', []);
            const isInWishlist = wishlist.some(item => item.id === product.id);
            
            const productLink = document.createElement('a');
            productLink.href = `product.html?slug=${encodeURIComponent(product.slug || product.id)}`;
            productLink.className = 'product-card-wrapper';
            productLink.innerHTML = `
                <div class="product-card">
                    <div class="product-image">
                        <img src="${imageUrl}" alt="${product.name}" onerror="this.src='${window.JMPOTTERS_CONFIG.images.baseUrl}placeholder.jpg'">
                        <button class="wishlist-btn ${isInWishlist ? 'active' : ''}" data-id="${product.id}" data-action="wishlist"><i class="icon-heart"></i></button>
                    </div>
                    <div class="product-info">
                        <h3 class="product-title">${escapeHtml(product.name)}</h3>
                        <div class="product-price">${formatPrice(product.price)}</div>
                        <div class="availability ${product.stock <= 0 ? 'out-of-stock' : ''}"><i class="icon-${product.stock > 0 ? 'check-circle' : 'x-circle'}"></i> ${product.stock > 0 ? 'In Stock' : 'Out of Stock'}</div>
                    </div>
                </div>
            `;
            productsGrid.appendChild(productLink);
        });
        
        setupProductInteractions();
    }
    
    function setupProductInteractions() {
        document.addEventListener('click', function(event) {
            const wishlistBtn = event.target.closest('[data-action="wishlist"]');
            if (wishlistBtn) {
                event.preventDefault();
                event.stopPropagation();
                const productId = parseInt(wishlistBtn.getAttribute('data-id'));
                const product = window.JMPOTTERS_PRODUCTS_CACHE?.find(p => p.id === productId);
                if (product) {
                    toggleWishlist(product);
                    wishlistBtn.classList.toggle('active');
                }
            }
        });
    }
    
    // ====================
    // CART FUNCTIONS
    // ====================
    function getCart() {
        try {
            return JSON.parse(localStorage.getItem('jmpotters_cart')) || [];
        } catch (e) {
            console.error('Failed to parse cart data:', e);
            localStorage.removeItem('jmpotters_cart');
            return [];
        }
    }
    
    function saveCart(cart) {
        localStorage.setItem('jmpotters_cart', JSON.stringify(cart));
        updateCartUI();
    }
    
    function addToCart(product, quantity = 1, options = {}) {
        let cart = getCart();
        const cartItem = {
            product_id: product.id, quantity, name: product.name, price: product.price || 0,
            image_url: product.image_url, category_slug: options.category_slug || getCurrentCategory(),
            color_name: options.color_name || null, size_value: options.size_value || null,
            added_at: new Date().toISOString()
        };
        
        const existingIndex = cart.findIndex(item => item.product_id === cartItem.product_id && item.color_name === cartItem.color_name && item.size_value === cartItem.size_value);
        if (existingIndex !== -1) {
            cart[existingIndex].quantity += quantity;
            showNotification(`Updated ${product.name} quantity`, 'info');
        } else {
            cart.push(cartItem);
            let text = product.name;
            if (options.color_name) text += ` (${options.color_name})`;
            if (options.size_value) text += ` - ${options.size_value}`;
            showNotification(`${text} added to cart!`, 'success');
        }
        saveCart(cart);
        openCart();
    }
    
    function updateCartUI() {
        const cart = getCart();
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        const wishlist = safeParseJSON('jmpotters_wishlist', []);
        
        const cartCount = document.getElementById('cartCount');
        if (cartCount) {
            cartCount.textContent = totalItems;
            cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
        }
        
        const wishlistCount = document.getElementById('wishlistCount');
        if (wishlistCount) {
            wishlistCount.textContent = wishlist.length;
            wishlistCount.style.display = wishlist.length > 0 ? 'flex' : 'none';
        }
        
        updateCartPanel();
    }
    
    function updateCartPanel() {
        const cart = getCart();
        const cartItems = document.getElementById('cartItems');
        const cartTotal = document.getElementById('cartTotal');
        
        if (!cartItems || !cartTotal) return;
        
        if (cart.length === 0) {
            cartItems.innerHTML = '<div class="cart-empty">Your cart is empty</div>';
            cartTotal.textContent = '₦0';
            return;
        }
        
        let html = '';
        let total = 0;
        cart.forEach((item, index) => {
            const itemTotal = (item.price || 0) * item.quantity;
            total += itemTotal;
            let itemDesc = item.name;
            if (item.color_name) itemDesc += ` (${item.color_name})`;
            if (item.size_value) itemDesc += ` - ${item.size_value}`;
            html += `
                <div class="cart-item">
                    <div class="cart-item-image"><img src="${getImageUrl(item.category_slug, item.image_url)}" alt="${item.name}"></div>
                    <div class="cart-item-details">
                        <div class="cart-item-name">${escapeHtml(itemDesc)}</div>
                        <div class="cart-item-price">${formatPrice(item.price)}</div>
                        <div>Qty: ${item.quantity}</div>
                    </div>
                    <button class="cart-item-remove" data-index="${index}"><i class="icon-trash-2"></i></button>
                </div>
            `;
        });
        
        cartItems.innerHTML = html;
        cartTotal.textContent = formatPrice(total);
        
        document.querySelectorAll('.cart-item-remove').forEach(btn => {
            btn.addEventListener('click', function() {
                let cart = getCart();
                cart.splice(parseInt(this.dataset.index), 1);
                saveCart(cart);
                showNotification('Item removed', 'info');
            });
        });
    }
    
    function openCart() {
        const cartPanel = document.getElementById('cartPanel');
        const cartOverlay = document.getElementById('cartOverlay');
        if (cartPanel) cartPanel.classList.add('active');
        if (cartOverlay) cartOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        updateCartPanel();
    }
    
    function closeCart() {
        const cartPanel = document.getElementById('cartPanel');
        const cartOverlay = document.getElementById('cartOverlay');
        if (cartPanel) cartPanel.classList.remove('active');
        if (cartOverlay) cartOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    function toggleWishlist(product) {
        let wishlist = safeParseJSON('jmpotters_wishlist', []);
        const exists = wishlist.some(item => item.id === product.id);
        if (exists) {
            wishlist = wishlist.filter(item => item.id !== product.id);
            showNotification(`${product.name} removed from wishlist`, 'info');
        } else {
            wishlist.push({ id: product.id, name: product.name, price: product.price, image_url: product.image_url, slug: product.slug });
            showNotification(`${product.name} added to wishlist!`, 'success');
        }
        localStorage.setItem('jmpotters_wishlist', JSON.stringify(wishlist));
        updateCartUI();
    }
    
    // ====================
    // RECEIPT UPLOAD TO SUPABASE STORAGE
    // ====================
    async function uploadReceiptToStorage(file, tempId) {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error('Database connection error');
        
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) throw new Error('File size exceeds 5MB limit');
        
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) throw new Error('Only JPG, PNG, WebP or PDF files are allowed');
        
        const ext = file.name.split('.').pop().toLowerCase();
        const safeName = tempId + '_' + Date.now() + '.' + ext;
        const filePath = 'receipts/' + safeName;
        
        const { data, error } = await supabase.storage
            .from('payment-receipts')
            .upload(filePath, file, { cacheControl: '3600', upsert: false });
        
        if (error) throw new Error('Upload failed: ' + error.message);
        
        const { data: urlData } = supabase.storage
            .from('payment-receipts')
            .getPublicUrl(filePath);
        
        return urlData.publicUrl;
    }
    
    // ====================
    // CHECKOUT CONFIRMATION MODAL
    // ====================
    function showCheckoutModal() {
        const cart = getCart();
        if (cart.length === 0) {
            showNotification('Your cart is empty', 'warning');
            return;
        }
        
        const user = safeParseJSON('jmpotters_user', null);
        if (!user || !user.address || !user.city || !user.state) {
            showNotification('Please complete your profile before checkout', 'warning');
            sessionStorage.setItem('checkoutRedirect', window.location.href);
            window.location.href = 'register.html';
            return;
        }
        
        let existing = document.getElementById('checkoutConfirmModal');
        if (existing) existing.remove();
        
        const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0);
        const shippingFee = subtotal >= 50000 ? 0 : 2000;
        const grandTotal = subtotal + shippingFee;
        
        let itemsHtml = '';
        cart.forEach(item => {
            const itemTotal = (item.price || 0) * item.quantity;
            let desc = escapeHtml(item.name);
            if (item.color_name) desc += ' (' + escapeHtml(item.color_name) + ')';
            if (item.size_value) desc += ' - ' + escapeHtml(item.size_value);
            itemsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:0.85rem;"><span style="flex:1;color:#e2e8f0;">' + desc + ' x' + item.quantity + '</span><span style="font-weight:600;color:#a5b4fc;">\u20A6' + itemTotal.toLocaleString() + '</span></div>';
        });
        
        const modal = document.createElement('div');
        modal.id = 'checkoutConfirmModal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:20000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px;backdrop-filter:blur(8px);';
        modal.innerHTML = `
            <div id="checkoutModalContent" style="background:linear-gradient(145deg,#0f172a,#1e293b);border-radius:1.5rem;width:100%;max-width:560px;margin:auto;box-shadow:0 25px 60px rgba(0,0,0,0.5);border:1px solid rgba(99,102,241,0.2);animation:slideIn 0.3s ease;">
                <div style="padding:24px 24px 0;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(99,102,241,0.2);padding-bottom:16px;">
                    <h2 style="color:#f1f5f9;font-size:1.25rem;font-weight:700;display:flex;align-items:center;gap:8px;"><i class="icon-clipboard-check" style="color:#818cf8;"></i> Confirm Your Order</h2>
                    <button id="closeCheckoutModal" style="background:rgba(255,255,255,0.08);border:none;width:36px;height:36px;border-radius:50%;color:#94a3b8;cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;transition:all 0.2s;"><i class="icon-x"></i></button>
                </div>
                <div style="padding:20px 24px;max-height:calc(100vh - 160px);overflow-y:auto;">
                    <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid rgba(255,255,255,0.06);">
                        <h3 style="color:#818cf8;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;font-weight:600;"><i class="icon-user"></i> Customer Information</h3>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.85rem;">
                            <div><span style="color:#64748b;font-size:0.75rem;">Name</span><div style="color:#e2e8f0;font-weight:500;">${escapeHtml(user.full_name || 'N/A')}</div></div>
                            <div><span style="color:#64748b;font-size:0.75rem;">Email</span><div style="color:#e2e8f0;font-weight:500;">${escapeHtml(user.email || 'N/A')}</div></div>
                            <div><span style="color:#64748b;font-size:0.75rem;">Phone</span><div style="color:#e2e8f0;font-weight:500;">${escapeHtml(user.phone || 'N/A')}</div></div>
                            <div><span style="color:#64748b;font-size:0.75rem;">Location</span><div style="color:#e2e8f0;font-weight:500;">${escapeHtml(user.city || '')}${user.city && user.state ? ', ' : ''}${escapeHtml(user.state || '')}</div></div>
                        </div>
                        <div style="margin-top:8px;"><span style="color:#64748b;font-size:0.75rem;">Address</span><div style="color:#e2e8f0;font-weight:500;font-size:0.85rem;">${escapeHtml(user.address || 'N/A')}</div></div>
                        <a href="register.html" style="display:inline-flex;align-items:center;gap:4px;color:#818cf8;font-size:0.75rem;margin-top:8px;text-decoration:none;"><i class="icon-pencil"></i> Edit Profile</a>
                    </div>
                    <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid rgba(255,255,255,0.06);">
                        <h3 style="color:#818cf8;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;font-weight:600;"><i class="icon-shopping-bag"></i> Order Summary</h3>
                        <div>${itemsHtml}</div>
                        <div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.1);">
                            <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:#94a3b8;margin-bottom:4px;"><span>Subtotal</span><span>\u20A6${subtotal.toLocaleString()}</span></div>
                            <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:#94a3b8;margin-bottom:4px;"><span>Shipping</span><span>${shippingFee === 0 ? 'Free' : '\u20A6' + shippingFee.toLocaleString()}</span></div>
                            <div style="display:flex;justify-content:space-between;font-size:1.05rem;font-weight:700;color:#a5b4fc;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);"><span>Grand Total</span><span>\u20A6${grandTotal.toLocaleString()}</span></div>
                        </div>
                    </div>
                    <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid rgba(255,255,255,0.06);">
                        <h3 style="color:#818cf8;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;font-weight:600;"><i class="icon-receipt"></i> Payment Receipt <span style="color:#ef4444;">*</span></h3>
                        <p style="color:#94a3b8;font-size:0.8rem;margin-bottom:12px;">Upload a screenshot or photo of your payment receipt (JPG, PNG, WebP or PDF, max 5MB).</p>
                        <div id="receiptUploadZone" style="border:2px dashed rgba(99,102,241,0.3);border-radius:12px;padding:24px;text-align:center;cursor:pointer;transition:all 0.25s;background:rgba(99,102,241,0.04);position:relative;">
                            <input type="file" id="receiptFileInput" accept="image/jpeg,image/png,image/webp,application/pdf" style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;cursor:pointer;">
                            <div id="receiptUploadContent">
                                <i class="icon-cloud-upload" style="font-size:2rem;color:#818cf8;margin-bottom:8px;"></i>
                                <p style="color:#e2e8f0;font-weight:500;font-size:0.9rem;">Drop your receipt here or click to browse</p>
                                <p style="color:#64748b;font-size:0.75rem;margin-top:4px;">JPG, PNG, WebP or PDF - Max 5MB</p>
                            </div>
                            <div id="receiptPreview" style="display:none;">
                                <img id="receiptPreviewImg" style="max-width:200px;max-height:150px;border-radius:8px;object-fit:cover;margin-bottom:8px;" alt="Receipt preview">
                                <div id="receiptFileName" style="color:#e2e8f0;font-size:0.85rem;font-weight:500;"></div>
                                <button type="button" id="removeReceiptBtn" style="background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3);padding:4px 12px;border-radius:6px;font-size:0.75rem;cursor:pointer;margin-top:8px;"><i class="icon-trash-2"></i> Remove</button>
                            </div>
                        </div>
                        <div id="receiptError" style="display:none;color:#f87171;font-size:0.8rem;margin-top:8px;"></div>
                    </div>
                    <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:16px;margin-bottom:20px;border:1px solid rgba(255,255,255,0.06);">
                        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">
                            <input type="checkbox" id="termsCheckbox" style="width:18px;height:18px;margin-top:2px;accent-color:#6366f1;cursor:pointer;flex-shrink:0;">
                            <span style="color:#cbd5e1;font-size:0.85rem;">I agree to the <a href="#" style="color:#818cf8;text-decoration:underline;" onclick="event.preventDefault();event.stopPropagation();">Terms and Conditions</a> of JMPOTTERS. I confirm that the information above is correct and the uploaded receipt is a valid proof of payment. <span style="color:#ef4444;">*</span></span>
                        </label>
                    </div>
                    <button id="completeOrderBtn" disabled style="width:100%;padding:14px;background:linear-gradient(135deg,#4b5563,#374151);color:#6b7280;border:none;border-radius:12px;font-weight:700;font-size:1rem;cursor:not-allowed;transition:all 0.3s;display:flex;align-items:center;justify-content:center;gap:8px;">
                        <i class="icon-lock"></i> Complete Order
                    </button>
                    <p id="checkoutValidationMsg" style="color:#f87171;font-size:0.8rem;text-align:center;margin-top:8px;">Please upload your payment receipt and agree to the Terms & Conditions.</p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        let selectedReceiptFile = null;
        const fileInput = document.getElementById('receiptFileInput');
        const uploadZone = document.getElementById('receiptUploadZone');
        const uploadContent = document.getElementById('receiptUploadContent');
        const preview = document.getElementById('receiptPreview');
        const previewImg = document.getElementById('receiptPreviewImg');
        const fileNameEl = document.getElementById('receiptFileName');
        const removeBtn = document.getElementById('removeReceiptBtn');
        const receiptError = document.getElementById('receiptError');
        const termsCheckbox = document.getElementById('termsCheckbox');
        const completeBtn = document.getElementById('completeOrderBtn');
        const validationMsg = document.getElementById('checkoutValidationMsg');
        const closeBtn = document.getElementById('closeCheckoutModal');
        
        function validateForm() {
            const hasReceipt = selectedReceiptFile !== null;
            const hasTerms = termsCheckbox.checked;
            const ready = hasReceipt && hasTerms;
            completeBtn.disabled = !ready;
            if (ready) {
                completeBtn.style.background = 'linear-gradient(135deg,#6366f1,#4f46e5)';
                completeBtn.style.color = 'white';
                completeBtn.style.cursor = 'pointer';
                completeBtn.style.boxShadow = '0 0 20px rgba(99,102,241,0.3)';
                validationMsg.style.display = 'none';
            } else {
                completeBtn.style.background = 'linear-gradient(135deg,#4b5563,#374151)';
                completeBtn.style.color = '#6b7280';
                completeBtn.style.cursor = 'not-allowed';
                completeBtn.style.boxShadow = 'none';
                let msg = [];
                if (!hasReceipt) msg.push('upload your payment receipt');
                if (!hasTerms) msg.push('agree to the Terms & Conditions');
                validationMsg.textContent = 'Please ' + msg.join(' and ') + '.';
                validationMsg.style.display = 'block';
            }
        }
        
        function handleFile(file) {
            receiptError.style.display = 'none';
            const maxSize = 5 * 1024 * 1024;
            if (file.size > maxSize) {
                receiptError.textContent = 'File is too large. Maximum size is 5MB.';
                receiptError.style.display = 'block';
                return;
            }
            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
            if (!allowedTypes.includes(file.type)) {
                receiptError.textContent = 'Invalid file type. Only JPG, PNG, WebP or PDF files are allowed.';
                receiptError.style.display = 'block';
                return;
            }
            selectedReceiptFile = file;
            fileNameEl.textContent = file.name;
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImg.src = e.target.result;
                    previewImg.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                previewImg.style.display = 'none';
                fileNameEl.innerHTML = '<i class="icon-file-text" style="color:#ef4444;font-size:2rem;margin-bottom:8px;display:block;"></i>' + escapeHtml(file.name);
            }
            uploadContent.style.display = 'none';
            preview.style.display = 'block';
            uploadZone.style.borderColor = 'rgba(34,197,94,0.5)';
            uploadZone.style.background = 'rgba(34,197,94,0.05)';
            validateForm();
        }
        
        fileInput.addEventListener('change', function() {
            if (this.files && this.files[0]) handleFile(this.files[0]);
        });
        
        uploadZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.style.borderColor = 'rgba(99,102,241,0.6)';
            this.style.background = 'rgba(99,102,241,0.08)';
        });
        uploadZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            if (!selectedReceiptFile) {
                this.style.borderColor = 'rgba(99,102,241,0.3)';
                this.style.background = 'rgba(99,102,241,0.04)';
            }
        });
        uploadZone.addEventListener('drop', function(e) {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
        });
        
        removeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            selectedReceiptFile = null;
            fileInput.value = '';
            uploadContent.style.display = 'block';
            preview.style.display = 'none';
            previewImg.style.display = 'none';
            uploadZone.style.borderColor = 'rgba(99,102,241,0.3)';
            uploadZone.style.background = 'rgba(99,102,241,0.04)';
            validateForm();
        });
        
        termsCheckbox.addEventListener('change', validateForm);
        
        closeBtn.addEventListener('click', function() {
            modal.remove();
        });
        modal.addEventListener('click', function(e) {
            if (e.target === modal) modal.remove();
        });
        
        completeBtn.addEventListener('click', async function() {
            if (completeBtn.disabled || isProcessingCheckout) return;
            isProcessingCheckout = true;
            completeBtn.disabled = true;
            completeBtn.innerHTML = '<i class="icon-loader"></i> Processing...';
            completeBtn.style.background = 'linear-gradient(135deg,#4b5563,#374151)';
            completeBtn.style.color = '#94a3b8';
            
            try {
                const tempId = 'order_' + Date.now();
                let receiptUrl = null;
                
                if (selectedReceiptFile) {
                    receiptUrl = await uploadReceiptToStorage(selectedReceiptFile, tempId);
                }
                
                const checkoutData = {
                    user_id: user.id,
                    email: user.email,
                    full_name: user.full_name,
                    phone: user.phone,
                    address: user.address,
                    city: user.city,
                    state: user.state,
                    notes: '',
                    receipt_url: receiptUrl
                };
                
                const order = await createOrder(checkoutData, cart);
                if (order) {
                    modal.remove();
                    closeCart();
                    window.location.href = 'invoice.html?order=' + order.order_number;
                } else {
                    completeBtn.disabled = false;
                    completeBtn.innerHTML = '<i class="icon-lock"></i> Complete Order';
                    validateForm();
                }
            } catch (error) {
                console.error('Checkout error:', error);
                showNotification('Checkout failed: ' + error.message, 'error');
                completeBtn.disabled = false;
                completeBtn.innerHTML = '<i class="icon-lock"></i> Complete Order';
                validateForm();
            } finally {
                isProcessingCheckout = false;
            }
        });
    }
    
    // ====================
    // ORDER CREATION WITH SEQUENTIAL ORDER NUMBERS (PLAIN DIGITS)
    // ====================
    async function createOrder(orderData, cart) {

        
        const supabase = getSupabaseClient();
        if (!supabase) {
            showNotification('Database connection error', 'error');
            return null;
        }
        
        try {
            const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0);
            const shippingFee = subtotal >= 50000 ? 0 : 2000;
            const grandTotal = subtotal + shippingFee;
            
            const orderNumber = await getNextOrderNumber();

            
            const items = cart.map(item => ({
                product_id: item.product_id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                color_name: item.color_name,
                size_value: item.size_value,
                image_url: item.image_url
            }));
            
            const orderInsert = {
                order_number: orderNumber,
                user_id: orderData.user_id,
                user_name: orderData.full_name,
                user_email: orderData.email,
                user_phone: orderData.phone,
                full_name: orderData.full_name,
                shipping_address: orderData.address,
                city: orderData.city,
                state: orderData.state,
                total_amount: subtotal,
                shipping_fee: shippingFee,
                grand_total: grandTotal,
                status: 'pending',
                payment_status: 'pending',
                payment_method: 'card',
                items: items,
                receipt_url: orderData.receipt_url || null,
                receipt_uploaded_at: orderData.receipt_url ? new Date().toISOString() : null,
                created_at: new Date().toISOString()
            };
            

            
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert(orderInsert)
                .select()
                .single();
            
            if (orderError) {
                console.error('Order error:', orderError);
                showNotification(`Order failed: ${orderError.message}`, 'error');
                return null;
            }
            
            localStorage.removeItem('jmpotters_cart');
            updateCartUI();
            showNotification(`Order ${orderNumber} placed successfully!`, 'success');
            return order;
            
        } catch (error) {
            console.error('Order creation error:', error);
            showNotification(`Failed to place order: ${error.message}`, 'error');
            return null;
        }
    }
    
    async function getOrderByNumber(orderNumber) {
        const supabase = getSupabaseClient();
        if (!supabase) {
            console.error('Database connection unavailable for order lookup');
            return null;
        }
        try {
            // orderNumber is already plain (e.g., "0003")

            
            const { data: order, error } = await supabase
                .from('orders')
                .select('*')
                .eq('order_number', orderNumber)
                .maybeSingle();
            
            if (error) throw error;
            return order;
        } catch (error) {
            console.error('Order fetch error:', error);
            return null;
        }
    }
    
    // ====================
    // PROCEED TO CHECKOUT
    // ====================
    async function proceedToCheckout() {
        if (isProcessingCheckout) {
            return;
        }
        
        const cart = getCart();
        if (cart.length === 0) {
            showNotification('Your cart is empty', 'warning');
            return;
        }
        
        const user = safeParseJSON('jmpotters_user', null);
        
        if (user && user.address && user.city && user.state) {
            showCheckoutModal();
            return;
        }
        
        if (user && (!user.address || !user.city || !user.state)) {
            showNotification('Please complete your profile before checkout', 'warning');
            sessionStorage.setItem('checkoutRedirect', window.location.href);
            window.location.href = 'register.html';
            return;
        }
        
        sessionStorage.setItem('checkoutRedirect', window.location.href);
        showNotification('Please create an account to complete your purchase', 'info');
        window.location.href = 'register.html';
    }
    
    // ====================
    // HEADER FUNCTIONS
    // ====================
    function setupHeaderInteractions() {
        const cartIcon = document.getElementById('cartIcon');
        if (cartIcon && !cartIcon._cartListener) {
            cartIcon._cartListener = true;
            cartIcon.addEventListener('click', (e) => { e.preventDefault(); openCart(); });
        }
        
        const wishlistIcon = document.getElementById('wishlistIcon');
        if (wishlistIcon && !wishlistIcon._wishlistListener) {
            wishlistIcon._wishlistListener = true;
            wishlistIcon.addEventListener('click', () => showNotification('Wishlist coming soon', 'info'));
        }
        
        const cartCheckoutBtn = document.getElementById('cartCheckoutBtn');
        if (cartCheckoutBtn && !cartCheckoutBtn._checkoutListener) {
            cartCheckoutBtn._checkoutListener = true;
            cartCheckoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeCart();
                proceedToCheckout();
            });
        }
        
        const closeCartBtn = document.getElementById('closeCartBtn');
        if (closeCartBtn && !closeCartBtn._closeListener) {
            closeCartBtn._closeListener = true;
            closeCartBtn.addEventListener('click', closeCart);
        }
        
        const cartOverlay = document.getElementById('cartOverlay');
        if (cartOverlay && !cartOverlay._overlayListener) {
            cartOverlay._overlayListener = true;
            cartOverlay.addEventListener('click', closeCart);
        }
        
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); });
    }
    
    // ====================
    // INITIALIZATION
    // ====================
    async function initializePage() {
        console.log('🚀 Initializing JMPOTTERS...');
        
        getSupabaseClient();
        setupHeaderInteractions();
        updateCartUI();
        
        document.querySelectorAll('#whatsappCheckout').forEach(btn => btn.remove());
        
        if (isProductPage()) {
            const slug = getSlugFromURL();
            if (slug) await loadSingleProductBySlug(slug);
            else window.location.href = 'index.html';
        } else {
            const category = getCurrentCategory();
            if (document.getElementById('productsGrid')) await loadProductsByCategory(category);
        }
        
        console.log('✅ JMPOTTERS ready');
    }
    
    // ====================
    // EXPOSE TO WINDOW
    // ====================
    window.JMPOTTERS = {
        addToCart,
        proceedToCheckout,
        showCheckoutModal,
        openCart,
        closeCart,
        formatPrice,
        getImageUrl,
        loadProductsByCategory,
        loadSingleProductBySlug,
        updateCartUI,
        getOrderByNumber,
        createOrder,
        uploadReceiptToStorage
    };
    
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializePage);
    else initializePage();
    
    console.log('✅ JMPOTTERS app loaded');
})();
