import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const adminUser = await base44.auth.me();

    if (!adminUser || adminUser.role !== 'admin') {
      return Response.json({ error: 'Apenas admins podem aprovar solicitações' }, { status: 403 });
    }

    const { request_id, action, rejection_reason } = await req.json();

    if (!request_id || !action) {
      return Response.json({ error: 'request_id e action são obrigatórios' }, { status: 400 });
    }

    // Buscar solicitação
    const requests = await base44.asServiceRole.entities.PermissionChangeRequest.filter({
      id: request_id
    });

    const request = requests[0];
    if (!request) {
      return Response.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    if (request.status !== 'pending') {
      return Response.json({ error: 'Solicitação já foi processada' }, { status: 400 });
    }

    // Atualizar status da solicitação
    await base44.asServiceRole.entities.PermissionChangeRequest.update(request_id, {
      status: action,
      reviewed_by: adminUser.email,
      reviewed_at: new Date().toISOString(),
      rejection_reason: action === 'rejected' ? rejection_reason : null
    });

    // Se aprovado, atualizar permissões do usuário
    if (action === 'approved') {
      const userProfiles = await base44.asServiceRole.entities.UserProfile.filter({
        user_email: request.requester_email
      });

      const userProfile = userProfiles[0];

      if (userProfile) {
        const updatedPermissions = { ...userProfile.permissions };

        if (request.request_type === 'page_access') {
          if (!updatedPermissions.pages) updatedPermissions.pages = {};
          updatedPermissions.pages[request.requested_page] = {
            read: true,
            create: false,
            update: false,
            delete: false
          };
        } else if (request.request_type === 'feature_access') {
          if (!updatedPermissions.features) updatedPermissions.features = {};
          updatedPermissions.features[request.requested_feature] = true;
        } else if (request.request_type === 'role_change') {
          await base44.asServiceRole.entities.UserProfile.update(userProfile.id, {
            role: request.requested_role,
            last_modified_by: adminUser.email
          });
        }

        if (request.request_type !== 'role_change') {
          await base44.asServiceRole.entities.UserProfile.update(userProfile.id, {
            permissions: updatedPermissions,
            last_modified_by: adminUser.email
          });
        }

        // Log da ação
        await base44.asServiceRole.entities.RBACLog.create({
          action_type: action === 'approved' ? 'request_approved' : 'request_rejected',
          user_email: request.requester_email,
          performed_by: adminUser.email,
          details: {
            request_type: request.request_type,
            requested_page: request.requested_page,
            requested_feature: request.requested_feature,
            requested_role: request.requested_role
          }
        });
      }
    }

    return Response.json({
      success: true,
      message: action === 'approved' ? 'Solicitação aprovada' : 'Solicitação rejeitada'
    });

  } catch (error) {
    console.error('Erro ao processar solicitação:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});