//HTTP REQUEST GETALL GETONE PUT POST DELETE
const API_BASE = 'http://localhost:3000';
const URL_REQUEST = `${API_BASE}/posts`;
const URL_COMMENTS = `${API_BASE}/comments`;

function getAuthToken() {
    return localStorage.getItem('authToken');
}

function setAuthToken(token) {
    localStorage.setItem('authToken', token);
}

function clearAuth() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
}

function getAuthHeaders() {
    const headers = {
        "Content-Type": "application/json"
    };
    const token = getAuthToken();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

function updateAuthStatus() {
    const statusEl = document.getElementById('auth-status');
    const changeSection = document.getElementById('change-password-section');
    const user = JSON.parse(localStorage.getItem('authUser') || 'null');

    if (user) {
        statusEl.textContent = `Đã đăng nhập: ${user.username} (${user.role})`;
        changeSection.style.display = 'block';
    } else {
        statusEl.textContent = 'Chưa đăng nhập';
        changeSection.style.display = 'none';
    }
}

async function login() {
    const username = document.getElementById('username_txt').value.trim();
    const password = document.getElementById('password_txt').value;

    if (!username || !password) {
        alert('Vui lòng nhập username và password');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || 'Đăng nhập không thành công');
            return;
        }
        const data = await res.json();
        setAuthToken(data.accessToken);
        localStorage.setItem('authUser', JSON.stringify(data.user));
        updateAuthStatus();
        alert('Đăng nhập thành công');
    } catch (error) {
        console.error(error);
        alert('Lỗi khi đăng nhập');
    }
}

function logout() {
    clearAuth();
    updateAuthStatus();
    alert('Đã đăng xuất');
}

async function changePassword() {
    const oldPassword = document.getElementById('oldpassword_txt').value;
    const newPassword = document.getElementById('newpassword_txt').value;

    if (!oldPassword || !newPassword) {
        alert('Vui lòng nhập cả mật khẩu cũ và mật khẩu mới');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/change-password`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ oldPassword, newPassword })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            alert(data.error || 'Không thể đổi mật khẩu');
            return;
        }

        alert('Đổi mật khẩu thành công');
    } catch (error) {
        console.error(error);
        alert('Lỗi khi đổi mật khẩu');
    }
}

// Lấy tất cả posts (bao gồm cả posts đã xoá mềm) và hiển thị
async function GetData() {
    try {
        let res = await fetch(URL_REQUEST);
        let posts = await res.json();
        
        let body_of_table = document.getElementById('table-body')
        body_of_table.innerHTML = "";
        for (const post of posts) {
            // Kiểm tra nếu post bị xoá mềm thì thêm class strikethrough
            const isDeletedClass = post.isDeleted ? 'deleted-post' : ''
            const strikethrough = post.isDeleted ? 'text-decoration: line-through;' : ''
            body_of_table.innerHTML +=
                `<tr class="${isDeletedClass}" style="${strikethrough}">
                <td>${post.id}</td>
                <td>${post.title}</td>
                <td>${post.views}</td>
                <td><input type='submit' onclick='SoftDelete(${post.id})' value='Delete'/>
                    <input type='submit' onclick='EditPost(${post.id})' value='Edit'/>
                    <input type='submit' onclick='ShowComments(${post.id})' value='Comments'/></td>
            </tr>`
        }
    } catch (error) {
        console.log(error);
    }
}
// Lấy maxId từ tất cả posts để tạo ID mới
async function GetMaxId() {
    try {
        let res = await fetch(URL_REQUEST);
        let posts = await res.json();
        let maxId = 0;
        for (const post of posts) {
            let id = parseInt(post.id);
            if (id > maxId) {
                maxId = id;
            }
        }
        return maxId + 1;
    } catch (error) {
        console.log(error);
        return 1;
    }
}

// Nếu ID trống -> tạo mới với ID tự tăng
// ID tồn tại thì sử dụng PUT để cập nhật
async function Save() {
    let id = document.getElementById("id_txt").value;
    let title = document.getElementById("title_txt").value;
    let views = document.getElementById("views_txt").value;
    let res;
    
    if (id === "" || id === null) {
        // Tạo mới - tính ID tự tăng
        id = await GetMaxId();
        res = await fetch(URL_REQUEST,
            {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    id: String(id),
                    title: title,
                    views: views,
                    isDeleted: false
                })
            }
        );
    } else {
        // Cập nhật bài post hiện có
        let resAnItem = await fetch(URL_REQUEST + '/' + id);
        if (resAnItem.ok) {
            res = await fetch(URL_REQUEST + '/' + id,
                {
                    method: "PUT",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        title: title,
                        views: views
                    })
                }
            );
        }
    }
    
    if (!res.ok) {
        console.log("Lỗi khi lưu");
    } else {
        console.log("Lưu thành công");
        document.getElementById("id_txt").value = "";
        document.getElementById("title_txt").value = "";
        document.getElementById("views_txt").value = "";
    }
    GetData();
    return false;
}

// Xoá mềm: Chỉ đặt isDeleted = true thay vì xóa hoàn toàn
async function SoftDelete(id) {
    let res = await fetch(URL_REQUEST + '/' + id);
    if (res.ok) {
        let post = await res.json();
        let updateRes = await fetch(URL_REQUEST + '/' + id, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                ...post,
                isDeleted: true
            })
        });
        if (updateRes.ok) {
            console.log("Xoá mềm thành công");
            GetData();
        }
    }
}

// Chỉnh sửa post: Load dữ liệu vào form
async function EditPost(id) {
    let res = await fetch(URL_REQUEST + '/' + id);
    if (res.ok) {
        let post = await res.json();
        document.getElementById("id_txt").value = post.id;
        document.getElementById("title_txt").value = post.title;
        document.getElementById("views_txt").value = post.views;
    }
}

// ===== CRUD COMMENTS =====

// Lấy tất cả comments của một post
async function GetCommentsByPostId(postId) {
    try {
        let res = await fetch(URL_COMMENTS);
        let comments = await res.json();
        return comments.filter(c => c.postId == postId && !c.isDeleted);
    } catch (error) {
        console.log(error);
        return [];
    }
}

// Hiển thị comments của post
async function ShowComments(postId) {
    let comments = await GetCommentsByPostId(postId);
    let commentText = comments.map(c => `[ID: ${c.id}] ${c.text}`).join('\n');
    alert(`Comments cho post ${postId}:\n${commentText || 'Không có comment'}`);
}

// Tạo comment mới
async function CreateComment(postId, text) {
    try {
        let comments = await (await fetch(URL_COMMENTS)).json();
        let maxId = 0;
        for (const comment of comments) {
            let id = parseInt(comment.id);
            if (id > maxId) {
                maxId = id;
            }
        }
        let newCommentId = String(maxId + 1);
        
        let res = await fetch(URL_COMMENTS, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                id: newCommentId,
                text: text,
                postId: String(postId),
                isDeleted: false
            })
        });
        
        if (res.ok) {
            console.log("Tạo comment thành công");
            return true;
        }
    } catch (error) {
        console.log(error);
    }
    return false;
}

// Cập nhật comment
async function UpdateComment(commentId, newText) {
    try {
        let res = await fetch(URL_COMMENTS + '/' + commentId);
        if (res.ok) {
            let comment = await res.json();
            let updateRes = await fetch(URL_COMMENTS + '/' + commentId, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    ...comment,
                    text: newText
                })
            });
            if (updateRes.ok) {
                console.log("Cập nhật comment thành công");
                return true;
            }
        }
    } catch (error) {
        console.log(error);
    }
    return false;
}

// Xoá mềm comment
async function SoftDeleteComment(commentId) {
    try {
        let res = await fetch(URL_COMMENTS + '/' + commentId);
        if (res.ok) {
            let comment = await res.json();
            let deleteRes = await fetch(URL_COMMENTS + '/' + commentId, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    ...comment,
                    isDeleted: true
                })
            });
            if (deleteRes.ok) {
                console.log("Xoá mềm comment thành công");
                return true;
            }
        }
    } catch (error) {
        console.log(error);
    }
    return false;
}

updateAuthStatus();
GetData()
