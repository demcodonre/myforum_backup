// 搜索历史数据
let searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];

// 自动补全数据
const autocompleteData = [];

// DOM 元素
const searchInput = document.getElementById('searchInput');
const searchBtn = document.querySelector('.search-btn');
const searchHistoryEl = document.getElementById('searchHistory');
const autocompleteResults = document.getElementById('autocompleteResults');

// 防抖函数
function debounce(fn, delay) {
    let timer;
    return function () {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, arguments), delay);
    };
}

// 显示搜索历史
function showSearchHistory() {
    if (searchHistory.length === 0) return;

    searchHistoryEl.innerHTML = `
        <div class="search-history-header">
            <span>最近搜索</span>
            <span class="clear-history">清除历史</span>
        </div>
        ${searchHistory.map(item => `
            <div class="search-history-item">${item}</div>
        `).join('')}
    `;
    searchHistoryEl.style.display = 'block';

    // 历史项点击
    document.querySelectorAll('.search-history-item').forEach(item => {
        item.addEventListener('click', function () {
            searchInput.value = this.textContent;
            performSearch(this.textContent);
        });
    });

    // 清除历史
    document.querySelector('.clear-history').addEventListener('click', function (e) {
        e.stopPropagation();
        searchHistory = [];
        localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
        searchHistoryEl.style.display = 'none';
    });
}

// 显示自动补全
function showAutocompleteResults(suggestions = []) {
    const inputValue = searchInput.value.toLowerCase();
    if (!inputValue) {
        autocompleteResults.style.display = 'none';
        return;
    }

    const filteredData = suggestions.length > 0
        ? suggestions
        : autocompleteData.filter(item =>
            item.toLowerCase().includes(inputValue) && !searchHistory.includes(item)
        );

    if (filteredData.length === 0) {
        autocompleteResults.style.display = 'none';
        return;
    }

    autocompleteResults.innerHTML = filteredData.map(item => `
        <div class="autocomplete-item">${item}</div>
    `).join('');
    autocompleteResults.style.display = 'block';

    // 添加补全项点击事件
    document.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', function () {
            searchInput.value = this.textContent;
            performSearch(this.textContent);
        });
    });
}

// 执行搜索
function performSearch(term) {
    if (!term.trim()) return;

    // 添加到搜索历史
    if (!searchHistory.includes(term)) {
        searchHistory.unshift(term);
        if (searchHistory.length > 5) {
            searchHistory.pop();
        }
        localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    }

    // 隐藏下拉菜单
    searchHistoryEl.style.display = 'none';
    autocompleteResults.style.display = 'none';

    // 跳转到搜索页面
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

            // 为更新项添加点击事件
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
    // 搜索相关事件
    searchInput.addEventListener('focus', showSearchHistory);
    searchInput.addEventListener('input', debounce(function () {
        const query = this.value.trim();
        if (!query) {
            autocompleteResults.style.display = 'none';
            return;
        }

        fetch(`/api/search/suggest?q=${encodeURIComponent(query)}`)
            .then(res => res.json())
            .then(data => {
                showAutocompleteResults(data.suggestions);
            });
    }, 300));

    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            performSearch(this.value.trim());
        }
    });

    searchBtn.addEventListener('click', function () {
        performSearch(searchInput.value.trim());
    });

    // 全局点击隐藏下拉菜单
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.search-container')) {
            searchHistoryEl.style.display = 'none';
            autocompleteResults.style.display = 'none';
        }
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