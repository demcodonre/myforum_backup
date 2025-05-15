// DOM 元素
const searchInput = document.getElementById('searchInput');
const searchBtn = document.querySelector('.search-btn');

// 防抖函数
function debounce(fn, delay) {
    let timer;
    return function () {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, arguments), delay);
    };
}

// 执行搜索
function performSearch(term) {
    if (!term.trim()) return;
    window.location.href = `/search?q=${encodeURIComponent(term)}`;
}

// 内容项点击处理
function handleContentItemClick() {
    const resourceId = this.dataset.resourceId || this.dataset.id;
    if (resourceId) {
        window.location.href = `/resources/${resourceId}`;
    }
}

// 加载最新更新
async function loadRecentUpdates() {
    try {
        const response = await fetch('/api/recent-updates');
        const updates = await response.json();

        const updateList = document.querySelector('.update-list');
        if (updateList) {
            updateList.innerHTML = updates.map(item => `
                <li class="update-item" data-id="${item._id}">
                    <div class="update-content">${item.title}</div>
                    <div class="update-time">${new Date(item.createdAt).toLocaleString()}</div>
                </li>
            `).join('');

            document.querySelectorAll('.update-item').forEach(item => {
                item.addEventListener('click', handleContentItemClick);
            });
        }
    } catch (err) {
        console.error('加载更新失败:', err);
    }
}

// 渲染资源列表
function renderResources(resources) {
    const leftContent = document.querySelector('.left-content');
    if (leftContent) {
        leftContent.innerHTML = resources.map(resource => `
            <div class="content-item" data-id="${resource._id}">
                <div class="item-image">
                    <img src="${resource.images[0] || '/images/placeholder.jpg'}" alt="${resource.title}">
                </div>
                <div class="item-text">
                    <h3 class="item-title">${resource.title}</h3>
                    <p class="item-description">${resource.description}</p>
                </div>
            </div>
        `).join('');

        // 绑定点击事件
        document.querySelectorAll('.content-item').forEach(item => {
            item.addEventListener('click', handleContentItemClick);
        });
    }
}

// 分类筛选功能
function setupCategoryFilters() {
    document.querySelectorAll('.category[data-category]').forEach(btn => {
        btn.addEventListener('click', async function (e) {
            e.preventDefault();
            const category = this.dataset.category;

            try {
                const response = await fetch(`/api/resources/${category}`);
                const resources = await response.json();

                renderResources(resources);

                // 更新活跃状态
                document.querySelectorAll('.category').forEach(el =>
                    el.classList.remove('active'));
                this.classList.add('active');
            } catch (err) {
                console.error('筛选失败:', err);
            }
        });
    });
}

// 事件监听
function setupEventListeners() {
    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            performSearch(this.value.trim());
        }
    });

    searchBtn.addEventListener('click', function () {
        performSearch(searchInput.value.trim());
    });
}


// 页面初始化
function init() {
    setupEventListeners();
    setupCategoryFilters();
    loadRecentUpdates();

    // 绑定内容项点击事件
    document.querySelectorAll('.content-item').forEach(item => {
        item.addEventListener('click', handleContentItemClick);
    });

    // 添加排序按钮点击效果
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            window.location.href = this.href;
        });
    });
}



// 启动应用
document.addEventListener('DOMContentLoaded', init);