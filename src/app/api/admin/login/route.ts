
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import bcrypt from 'bcryptjs';
import { generateAdminJwt } from '@/lib/jwtAdmin'; // Import from lib

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return new NextResponse(
        JSON.stringify({ success: false, error: 'Missing email or password' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. البحث عن المسؤول
    const { data: admin, error: fetchError } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (fetchError || !admin) {
      console.error('Admin fetch error or admin not found:', fetchError);
      return new NextResponse(
        JSON.stringify({ success: false, error: 'Invalid credentials' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. التحقق من كلمة المرور
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);

    if (!isValidPassword) {
      return new NextResponse(
        JSON.stringify({ success: false, error: 'Invalid credentials (password mismatch)' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. تحديث وقت آخر تسجيل دخول
    const { error: updateError } = await supabaseAdmin
      .from('admins')
      .update({ last_login: new Date().toISOString() })
      .eq('id', admin.id);

    if (updateError) {
      console.error('Error updating admin last_login:', updateError);
      // Non-critical, proceed but log
    }

    // 4. إنشاء توكن جلسة (JWT)
    let token;
    try {
      token = generateAdminJwt(admin.id, admin.email, admin.role);
    } catch (jwtError: any) {
      console.error('Error generating admin JWT:', jwtError);
      return new NextResponse(
        JSON.stringify({ success: false, error: 'Could not generate session token. ' + (jwtError.message || '') }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }


    // 5. إرسال التوكن إلى العميل (بشكل آمن)
    return new NextResponse(
      JSON.stringify({
        success: true,
        message: 'Login successful',
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          role: admin.role,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Critical unhandled error in admin login API:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return new NextResponse(
      JSON.stringify({ success: false, error: 'Internal server error. Please check server logs.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
